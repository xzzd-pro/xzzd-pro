const assert = require("node:assert/strict")
const { test } = require("node:test")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function harness() {
  let cursor = 0
  let root = false
  const slots = []
  const effects = []
  const timers = new Map()
  const listeners = new Map()
  const classes = new Set()
  const values = { theme: "light", "beautify-enabled": true }
  const classList = {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name))
  }
  const document = {
    readyState: "complete",
    body: { classList, removeAttribute() {} },
    documentElement: { classList, removeAttribute() {}, style: { removeProperty() {} } },
    querySelector: () => root ? {} : null,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => {
      if (listeners.get(name) === callback) listeners.delete(name)
    }
  }
  const react = {
    useRef(initial) {
      const index = cursor++
      return slots[index] ||= { current: initial }
    },
    useEffect(callback, deps) {
      const index = cursor++
      const old = slots[index]
      if (!old || deps.some((dep, i) => dep !== old.deps[i])) {
        effects.push(() => {
          old?.cleanup?.()
          slots[index] = { deps, cleanup: callback() }
        })
      }
    }
  }
  let shared
  let initialization
  let mountAirPage
  function load(relative) {
    const source = fs.readFileSync(path.resolve(__dirname, "../..", relative), "utf8")
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    const exports = {}
    vm.runInNewContext(code, {
      exports, document, console: { log() {}, error() {} },
      setTimeout: (callback) => { const id = {}; timers.set(id, callback); return id },
      clearTimeout: (id) => timers.delete(id),
      require(name) {
        if (name === "react") return react
        if (name === "@/lib/storage") return { storage: {} }
        if (name === "@/lib/themeDom") return { bootstrapStoredTheme() {}, applyThemeToDocument() {}, normalizeTheme: (x) => x }
        if (name === "@plasmohq/storage/hook") return { useStorage: ({ key }) => [values[key], null, { isLoading: false }] }
        if (name === "@/shared/contentScripts/createBeautifierInjector") return shared
        if (name === "./useBeautifierInitialization" || name === "@/shared/contentScripts/useBeautifierInitialization") return initialization
        if (name === "@/features/air/airPageBeautifier") return { mountAirPage }
        throw new Error(name)
      }
    })
    return exports
  }
  initialization = load("src/shared/contentScripts/useBeautifierInitialization.ts")
  shared = load("src/shared/contentScripts/createBeautifierInjector.tsx")
  return {
    shared, values, classes, document, listeners, timers,
    setRoot(value = true) { root = value },
    air(mount) { mountAirPage = mount; return load("src/contents/airPage.tsx").default },
    render(component) { cursor = 0; component(); effects.splice(0).forEach((effect) => effect()) },
    dispose() { slots.forEach((slot) => slot.cleanup?.()) },
    async flush() { for (let i = 0; i < 12; i++) await Promise.resolve() },
    async tick() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); await this.flush() }
  }
}

test("synchronous throw and no-op are retried; successful mount stops retries", async () => {
  const h = harness()
  let calls = 0
  const component = h.shared.createBeautifierInjector({ pageName: "test", beautify() {
    calls++
    if (calls === 1) throw new Error("early failure")
    if (calls === 3) h.setRoot()
  } })
  h.render(component)
  await h.flush()
  assert.equal(calls, 1)
  await h.tick()
  assert.equal(calls, 2)
  await h.tick()
  assert.equal(calls, 3)
  assert.equal(h.timers.size, 0)
})

test("partial root on rejected mount does not prevent retry; retries are bounded", async () => {
  const h = harness()
  let calls = 0
  const component = h.shared.createBeautifierInjector({ pageName: "test", beautify() {
    calls++
    h.setRoot()
    return Promise.reject(new Error("late failure"))
  } })
  h.render(component)
  await h.flush()
  await h.tick()
  await h.tick()
  assert.equal(calls, 3)
  assert.equal(h.timers.size, 0)
})

test("theme rerender and disable/re-enable share the in-flight mount", async () => {
  const h = harness()
  let calls = 0
  let finish
  const component = h.shared.createBeautifierInjector({ pageName: "test", beautify() {
    calls++
    return new Promise((resolve) => { finish = () => { h.setRoot(); resolve() } })
  } })
  h.render(component)
  await h.flush()
  h.values.theme = "dark"
  h.render(component)
  h.values["beautify-enabled"] = false
  h.render(component)
  h.values["beautify-enabled"] = true
  h.render(component)
  finish()
  await h.flush()
  assert.equal(calls, 1)
  assert.equal(h.timers.size, 0)
})

test("cleanup cancels scheduled retries", async () => {
  const h = harness()
  let calls = 0
  const component = h.shared.createBeautifierInjector({ pageName: "test", beautify() { calls++ } })
  h.render(component)
  await h.flush()
  assert.equal(h.timers.size, 1)
  h.dispose()
  await h.tick()
  assert.equal(h.timers.size, 0)
  assert.equal(calls, 1)
})

test("retry rechecks skip predicate after the page route changes", async () => {
  const h = harness()
  let calls = 0
  let skip = false
  const component = h.shared.createBeautifierInjector({
    pageName: "test",
    shouldSkip: () => skip,
    beautify() { calls++ }
  })
  h.render(component)
  await h.flush()
  skip = true
  await h.tick()
  assert.equal(calls, 1)
  assert.equal(h.timers.size, 0)
})

test("Air can initialize after initially disabled and removes readiness listener", async () => {
  const h = harness()
  let calls = 0
  h.document.readyState = "loading"
  h.values["beautify-enabled"] = false
  const component = h.air(() => { calls++; h.setRoot() })
  h.render(component)
  assert(h.classes.has("xzzdpro-disabled"))
  h.values["beautify-enabled"] = true
  h.render(component)
  assert(!h.classes.has("xzzdpro-disabled"))
  assert.equal(h.listeners.size, 1)
  h.values["beautify-enabled"] = false
  h.render(component)
  assert.equal(h.listeners.size, 0)
  h.values["beautify-enabled"] = true
  h.render(component)
  h.document.readyState = "complete"
  h.listeners.get("DOMContentLoaded")()
  await h.flush()
  assert.equal(calls, 1)
  h.dispose()
  assert.equal(h.listeners.size, 0)
})
