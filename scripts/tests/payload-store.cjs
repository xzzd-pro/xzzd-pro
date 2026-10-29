const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript")

const compile = (path) =>
  ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText
const INDEX_SOURCE = compile("src/background/payload-index.ts")
const STORE_SOURCE = compile("src/assistant/attachment-payload-store.ts")

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// Storage whose get/set yield to the event loop, like chrome.storage does.
function fakeStorage(initial = {}, { failSet } = {}) {
  const data = { ...initial }
  return {
    data,
    async get(keys) {
      await tick()
      const list = typeof keys === "string" ? [keys] : keys
      return Object.fromEntries(
        list.filter((key) => key in data).map((key) => [key, data[key]])
      )
    },
    async set(items) {
      await tick()
      if (failSet && Object.keys(items).some(failSet)) throw new Error("quota")
      Object.assign(data, JSON.parse(JSON.stringify(items)))
    },
    async remove(keys) {
      await tick()
      for (const key of [].concat(keys)) delete data[key]
    }
  }
}

function loadIndex() {
  const exports = {}
  vm.runInNewContext(INDEX_SOURCE, { exports, Promise, Array })
  return exports
}

test("concurrent index changes from several tabs are all kept", async () => {
  const { applyPayloadIndexOp, PAYLOAD_INDEX_KEY } = loadIndex()
  const storage = fakeStorage()
  const entry = (n) => ({
    type: "text",
    size: n,
    createdAt: n,
    lastAccessed: n
  })
  await Promise.all([
    applyPayloadIndexOp({ op: "put", id: "a", entry: entry(1) }, storage),
    applyPayloadIndexOp({ op: "put", id: "b", entry: entry(2) }, storage),
    applyPayloadIndexOp({ op: "put", id: "c", entry: entry(3) }, storage),
    applyPayloadIndexOp({ op: "touch", id: "a", at: 9 }, storage)
  ])
  const index = storage.data[PAYLOAD_INDEX_KEY]
  assert.deepEqual(Object.keys(index).sort(), ["a", "b", "c"])
  assert.equal(index.a.lastAccessed, 9)
  await applyPayloadIndexOp({ op: "delete", ids: ["a", "c"] }, storage)
  assert.deepEqual(Object.keys(storage.data[PAYLOAD_INDEX_KEY]), ["b"])
})

test("a failed index change does not block later ones", async () => {
  const { applyPayloadIndexOp, PAYLOAD_INDEX_KEY } = loadIndex()
  let fail = true
  const storage = fakeStorage()
  const flaky = {
    get: storage.get,
    set: async (items) => {
      if (fail) {
        fail = false
        throw new Error("quota")
      }
      return storage.set(items)
    }
  }
  const entry = { type: "text", size: 1, createdAt: 1, lastAccessed: 1 }
  await assert.rejects(
    applyPayloadIndexOp({ op: "put", id: "a", entry }, flaky)
  )
  await applyPayloadIndexOp({ op: "put", id: "b", entry }, flaky)
  assert.deepEqual(Object.keys(storage.data[PAYLOAD_INDEX_KEY]), ["b"])
})

test("only well-formed index changes are accepted", () => {
  const { isPayloadIndexOp } = loadIndex()
  assert.equal(isPayloadIndexOp({ op: "delete", ids: ["a"] }), true)
  assert.equal(isPayloadIndexOp({ op: "touch", id: "a", at: 1 }), true)
  assert.equal(isPayloadIndexOp({ op: "delete", ids: [1] }), false)
  assert.equal(isPayloadIndexOp({ op: "clear" }), false)
  assert.equal(isPayloadIndexOp(null), false)
})

// Fake page IndexedDB holding the legacy payloads.
function fakeIndexedDB({ records = [], readError = false } = {}) {
  const calls = { deleted: 0 }
  const request = (setup) => {
    const req = {}
    setTimeout(() => setup(req), 0)
    return req
  }
  return {
    calls,
    open: () =>
      request((req) => {
        if (readError) return req.onerror?.()
        req.result = {
          objectStoreNames: { contains: () => true },
          close() {},
          transaction: () => ({
            objectStore: () => ({
              getAll: () =>
                request((get) => {
                  get.result = records
                  get.onsuccess?.()
                })
            })
          })
        }
        req.onsuccess?.()
      }),
    deleteDatabase: () => {
      calls.deleted += 1
      return request((req) => req.onsuccess?.())
    }
  }
}

function loadStore({ storage, indexedDB, indexResponse = { ok: true } }) {
  const exports = {}
  const ops = []
  vm.runInNewContext(STORE_SOURCE, {
    exports,
    chrome: { storage: { local: storage } },
    indexedDB,
    Blob,
    TextEncoder,
    setTimeout,
    console: { warn() {}, error() {} },
    require: (name) =>
      name === "@plasmohq/messaging"
        ? {
            sendToBackground: async ({ body }) => {
              ops.push(body)
              return indexResponse
            }
          }
        : { dataUriToBlob: () => new Blob() }
  })
  return { ...exports, ops }
}

const legacyRecord = (id) => ({
  id,
  type: "text",
  data: "hello",
  size: 5,
  createdAt: 1,
  lastAccessed: 1
})

test("legacy payloads are copied, then the old database is deleted", async () => {
  const storage = fakeStorage()
  const indexedDB = fakeIndexedDB({ records: [legacyRecord("x")] })
  const store = loadStore({ storage, indexedDB })
  await store.gcPayloads(Infinity)
  await tick()
  await tick()
  assert.equal(storage.data["xzzdpro_payload:x"].data, "hello")
  // The op comes from the vm context, so compare plain copies.
  assert.deepEqual(JSON.parse(JSON.stringify(store.ops[0])), {
    op: "put",
    id: "x",
    entry: {
      type: "text",
      size: 5,
      storedBytes: 5,
      createdAt: 1,
      lastAccessed: 1
    }
  })
  assert.equal(storage.data.xzzdpro_payload_legacy_migrated, true)
  assert.equal(indexedDB.calls.deleted, 1)
  assert.equal(storage.data.xzzdpro_payload_legacy_deleted, true)
})

test("an unreadable legacy database is kept for a later retry", async () => {
  const storage = fakeStorage()
  const indexedDB = fakeIndexedDB({ readError: true })
  await loadStore({ storage, indexedDB }).gcPayloads(Infinity)
  assert.equal(indexedDB.calls.deleted, 0)
  assert.equal(storage.data.xzzdpro_payload_legacy_migrated, undefined)
})

test("a failed copy keeps the legacy database and retries on the next load", async () => {
  const storage = fakeStorage({}, { failSet: (key) => key.endsWith(":y") })
  const indexedDB = fakeIndexedDB({
    records: [legacyRecord("x"), legacyRecord("y")]
  })
  await loadStore({ storage, indexedDB }).gcPayloads(Infinity)
  assert.equal(indexedDB.calls.deleted, 0)
  assert.equal(storage.data.xzzdpro_payload_legacy_migrated, undefined)

  // Next page load: storage works again, so the move completes.
  const healthy = fakeStorage(storage.data)
  await loadStore({ storage: healthy, indexedDB }).gcPayloads(Infinity)
  await tick()
  await tick()
  assert.equal(healthy.data["xzzdpro_payload:y"].data, "hello")
  assert.equal(healthy.data.xzzdpro_payload_legacy_migrated, true)
  assert.equal(indexedDB.calls.deleted, 1)
})

test("a payload whose index update fails is not left behind", async () => {
  const storage = fakeStorage({ xzzdpro_payload_legacy_migrated: true })
  const store = loadStore({
    storage,
    indexedDB: fakeIndexedDB(),
    indexResponse: { ok: false, error: "context invalidated" }
  })
  await assert.rejects(
    store.putPayload({ id: "z", type: "text", data: "hi", size: 2 }),
    /context invalidated/
  )
  assert.equal(storage.data["xzzdpro_payload:z"], undefined)
})

test("garbage collection counts stored bytes, not the original file size", async () => {
  const entry = (storedBytes, lastAccessed) => ({
    type: "pdf_blob",
    size: 30,
    storedBytes,
    createdAt: 1,
    lastAccessed
  })
  const storage = fakeStorage({
    xzzdpro_payload_legacy_migrated: true,
    xzzdpro_payload_legacy_deleted: true,
    xzzdpro_payload_index: { old: entry(40, 1), new: entry(40, 2) },
    "xzzdpro_payload:old": { type: "pdf_blob", data: "x" },
    "xzzdpro_payload:new": { type: "pdf_blob", data: "x" }
  })
  const store = loadStore({ storage, indexedDB: fakeIndexedDB() })
  // Original sizes total 60 (fits 70), but 80 bytes are stored.
  const result = await store.gcPayloads(70)
  assert.deepEqual([...result.removed], ["old"])
  assert.equal(result.totalBytes, 40)
  assert.equal(storage.data["xzzdpro_payload:old"], undefined)
  assert.deepEqual(JSON.parse(JSON.stringify(store.ops)), [
    { op: "delete", ids: ["old"] }
  ])
})
