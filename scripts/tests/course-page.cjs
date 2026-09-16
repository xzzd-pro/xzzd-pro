const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const { test } = require("node:test")
const ts = require("typescript")

// Execute the production module, exposing its private loader only in this VM.
// Mock browser/React/network boundaries so response ordering is deterministic.
function createHarness() {
  const filename = path.resolve(
    __dirname,
    "../../src/features/courses/coursePageBeautifier.tsx"
  )
  const source = fs.readFileSync(filename, "utf8") +
    "\nexport { loadAndRenderCourses };"
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React
    }
  }).outputText
  const pending = []
  const renders = []
  const roots = []
  let container = { isConnected: true }
  const context = {
    exports: {},
    console,
    document: { querySelector: () => container },
    require(name) {
      if (name === "react") {
        return { createElement: (_component, props) => props }
      }
      if (name === "react-dom/client") {
        return {
          createRoot(target) {
            const root = {
              container: target,
              unmounted: false,
              unmount() { this.unmounted = true },
              render(props) { renders.push({ container: target, props }) }
            }
            roots.push(root)
            return root
          }
        }
      }
      if (name === "@/shared/api/myCoursesApi") {
        return {
          createMyCoursesPayload: (payload) => payload,
          fetchMyCoursesResponse: () => new Promise((resolve) => {
            pending.push((courses) => resolve({
              ok: true,
              json: async () => ({ courses })
            }))
          })
        }
      }
      // Layout/component imports are outside these loader-focused tests.
      return {}
    }
  }
  vm.runInNewContext(code, context, { filename })
  return {
    load: context.exports.loadAndRenderCourses,
    pending,
    renders,
    roots,
    get container() { return container },
    replaceContainer() {
      container.isConnected = false
      container = { isConnected: true }
    },
    completedRenders: () => renders.filter(({ props }) => !props.loading)
  }
}

test("an older response cannot overwrite the latest course search", async () => {
  const h = createHarness()
  const older = h.load({ keyword: "old" })
  const latest = h.load({ keyword: "new" })
  h.pending[1](["new"])
  await latest
  h.pending[0](["old"])
  await older
  assert.equal(h.completedRenders().length, 1)
  assert.equal(h.completedRenders()[0].props.courses[0], "new")
})

test("a response cannot render into a detached course container", async () => {
  const h = createHarness()
  const loading = h.load()
  assert.equal(h.renders.length, 1)
  h.container.isConnected = false
  h.pending[0](["detached"])
  await loading
  assert.equal(h.completedRenders().length, 0)
})

test("a replacement container receives a fresh root and releases the old root", async () => {
  const h = createHarness()
  const original = h.load()
  h.pending[0](["original"])
  await original
  const originalRoot = h.roots[0]
  h.replaceContainer()
  const replacement = h.load()
  assert.equal(originalRoot.unmounted, true)
  assert.equal(h.roots.length, 2)
  assert.equal(h.roots[1].container, h.container)
  h.pending[1](["replacement"])
  await replacement
  assert.equal(h.renders.at(-1).container, h.container)
  assert.equal(h.renders.at(-1).props.courses[0], "replacement")
})
