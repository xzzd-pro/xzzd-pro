const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript")
const source = ts.transpileModule(
  fs.readFileSync("src/features/bulletin/find-notification-user.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText
function load(fetch) {
  const exports = {}
  vm.runInNewContext(source, { exports, fetch, AbortController })
  return exports.findNotificationUser
}
test("a fast later course resolves without waiting for the first slow course", async () => {
  let started = 0,
    aborted = 0
  const find = load((url, { signal }) => {
    started++
    if (url.includes("/2/"))
      return Promise.resolve({
        ok: true,
        json: async () => ({ activity_reads: [{ created_by_id: 42 }] })
      })
    return new Promise((_, reject) =>
      signal.addEventListener(
        "abort",
        () => {
          aborted++
          reject(Error("aborted"))
        },
        { once: true }
      )
    )
  })
  assert.equal(
    await find(Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }))),
    "42"
  )
  assert.equal(started, 4)
  assert.equal(aborted, 3)
})
test("empty and failing courses continue; parent cancellation stops pending work", async () => {
  const find = load(async (url) => {
    if (url.includes("/1/")) throw Error("offline")
    return { ok: true, json: async () => ({ activity_reads: [] }) }
  })
  assert.equal(await find([{ id: 1 }, { id: 2 }]), null)
  const controller = new AbortController()
  let calls = 0
  const cancelled = load((_, { signal }) => {
    calls++
    return new Promise((_, reject) =>
      signal.addEventListener("abort", () => reject(Error("aborted")), {
        once: true
      })
    )
  })
  const pending = cancelled(
    Array.from({ length: 10 }, (_, id) => ({ id })),
    controller.signal
  )
  controller.abort()
  assert.equal(await pending, null)
  assert.equal(calls, 4)
})
