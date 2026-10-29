const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript")

const source = ts.transpileModule(
  fs.readFileSync("src/shared/api/current-user.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText

const DAY = 24 * 60 * 60 * 1000

// Loads current-user.ts with fake storage, page name and lookup network.
function load({
  stored,
  pageName = "",
  foundId = "42",
  coursesOk = true
} = {}) {
  const data = stored === undefined ? {} : { xzzdpro_current_user_id: stored }
  const calls = { lookups: 0 }
  const mod = {}
  vm.runInNewContext(source, {
    exports: mod,
    Date,
    Promise,
    Array,
    console: { warn() {} },
    document: {
      querySelector: () => (pageName ? { textContent: ` ${pageName} ` } : null)
    },
    require: (name) => {
      if (name === "@/lib/storage")
        return {
          storage: {
            get: async (key) => data[key],
            set: async (key, value) => {
              data[key] = value
            }
          }
        }
      if (name === "./find-current-user")
        return {
          findCurrentUserId: async () => {
            calls.lookups += 1
            await new Promise((resolve) => setTimeout(resolve, 5))
            return foundId
          }
        }
      if (name === "./load-error")
        return {
          LoadError: class extends Error {
            constructor(message, status) {
              super(message)
              this.status = status
            }
          }
        }
      return {
        createMyCoursesPayload: () => ({}),
        fetchMyCoursesResponse: async () => ({
          ok: coursesOk,
          status: coursesOk ? 200 : 500,
          json: async () => ({ courses: [{ id: 1 }] })
        })
      }
    }
  })
  return { ...mod, data, calls }
}

test("a fresh cached id is used without looking it up", async () => {
  const api = load({
    stored: { id: "7", name: "张三", savedAt: Date.now() - DAY },
    pageName: "张三"
  })
  assert.equal(await api.getCurrentUserId(), "7")
  assert.equal(api.calls.lookups, 0)
})

test("the first lookup is cached with the page's user name", async () => {
  const api = load({ pageName: "张三" })
  assert.equal(await api.getCurrentUserId(), "42")
  const saved = api.data.xzzdpro_current_user_id
  assert.equal(saved.id, "42")
  assert.equal(saved.name, "张三")
})

test("a different signed-in name, an expired entry or refresh looks it up again", async () => {
  const other = load({
    stored: { id: "7", name: "张三", savedAt: Date.now() },
    pageName: "李四"
  })
  assert.equal(await other.getCurrentUserId(), "42")

  const expired = load({ stored: { id: "7", savedAt: Date.now() - 31 * DAY } })
  assert.equal(await expired.getCurrentUserId(), "42")

  const fresh = load({ stored: { id: "7", savedAt: Date.now() } })
  assert.equal(await fresh.getCurrentUserId({ refresh: true }), "42")
})

test("concurrent calls in one page share a single lookup", async () => {
  const api = load()
  const ids = await Promise.all([
    api.getCurrentUserId(),
    api.getCurrentUserId()
  ])
  assert.deepEqual(ids, ["42", "42"])
  assert.equal(api.calls.lookups, 1)
})

test("a failed course list is reported, not cached", async () => {
  const api = load({ coursesOk: false })
  await assert.rejects(api.getCurrentUserId(), (error) => error.status === 500)
  assert.equal(api.data.xzzdpro_current_user_id, undefined)
})
