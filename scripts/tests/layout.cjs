const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const repo = path.resolve(__dirname, '../..')

class Element extends EventTarget {
  constructor() {
    super(); this.isConnected = true; this.registrations = []; this.offsetWidth = 100
    const classes = new Set()
    this.classList = { add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x) }
    this.style = { setProperty(k, v) { this[k] = v }, getPropertyValue(k) { return this[k] || '' } }
  }
  addEventListener(type, callback, options) {
    this.registrations.push({ type, options })
    super.addEventListener(type, callback, options)
  }
  count(type) { return this.registrations.filter(x => x.type === type && !x.options?.signal?.aborted).length }
  setAttribute(key, value) { this[key] = value }
}
function harness() {
  const nodes = new Map(), observers = [], roots = [], watches = new Set(), reads = [], themes = []
  const document = new Element(), window = new Element()
  document.documentElement = new Element(); document.body = new Element()
  document.querySelector = selector => nodes.get(selector) || null
  document.getElementById = id => nodes.get('#' + id) || null
  class Storage {
    get() { return new Promise(resolve => reads.push(resolve)) }
    async set() {}
    watch(callbacks) { watches.add(callbacks) }
    unwatch(callbacks) { watches.delete(callbacks) }
  }
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe() { this.active = true }
    disconnect() { this.active = false }
  }
  const cache = new Map()
  function source(file) {
    return fs.readFileSync(path.join(repo, file), 'utf8')
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    const code = ts.transpileModule(source(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText
    function requireModule(name) {
      if (name === '@plasmohq/storage') return { Storage }
      if (name === 'react') return { createElement: (_type, props) => props }
      if (name === 'react-dom/client') return { createRoot() { const root = { unmounted: false, render() {}, unmount() { this.unmounted = true } }; roots.push(root); return root } }
      if (name.includes('avatar-upload') || name.includes('courseDataService') || name.includes('myCoursesApi')) return {}
      if (name === '@/lib/themeDom') return { normalizeTheme: x => x, getFallbackTheme: () => 'light', applyThemeToDocument: x => themes.push(x) }
      if (!(name.startsWith('.') || name.startsWith('@/'))) throw new Error('Unexpected dependency ' + name)
      const base = name.startsWith('@/') ? 'src/' + name.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), name))
      for (const candidate of [base + '.ts', base + '.tsx', base + '/index.ts']) {
        try { source(candidate) } catch { continue }
        return load(candidate)
      }
      throw new Error('Missing dependency ' + name + ' from ' + file)
    }
    vm.runInNewContext(code, { exports: module.exports, module, require: requireModule, console, document, window, MutationObserver, AbortController, chrome: { runtime: { id: 'test' } } }, { filename: file })
    return module.exports
  }
  return { load, nodes, roots, watches, reads, themes, document, window,
    add(selector) { const element = new Element(); nodes.set(selector, element); return element },
    sweep() { observers.filter(x => x.active).forEach(x => x.callback()) }
  }
}

test('bindings deduplicate owners, dispose removed owners, and run late cleanup', () => {
  const h = harness(), { bindLayoutControl } = h.load('src/shared/layout/bindings.ts')
  const owner = new Element(), binding = bindLayoutControl('test', owner)
  let cleanups = 0
  binding.onCleanup(() => cleanups++)
  assert.equal(bindLayoutControl('test', owner), null)
  owner.isConnected = false; h.sweep()
  assert.equal(binding.signal.aborted, true); assert.equal(cleanups, 1)
  binding.onCleanup(() => cleanups++); binding.dispose()
  assert.equal(cleanups, 2)
})

test('header setup binds once and cleans listeners and avatar root on removal', () => {
  const h = harness(), header = h.load('src/shared/layout/header.tsx')
  const button = h.add('#help-btn'), modal = h.add('#help-modal')
  h.add('#modal-close'); const avatar = h.add('#user-avatar-container')
  header.setupHelpModal(); header.setupHelpModal(); header.setupAvatarUpload(); header.setupAvatarUpload()
  assert.equal(button.count('click'), 1); assert.equal(h.document.count('keydown'), 1); assert.equal(h.roots.length, 1)
  button.dispatchEvent(new Event('click')); assert.equal(modal.classList.contains('active'), true)
  modal.isConnected = false; avatar.isConnected = false; h.sweep()
  assert.equal(button.count('click'), 0); assert.equal(h.document.count('keydown'), 0); assert.equal(h.roots[0].unmounted, true)
})

test('theme setup watches once, unwatches on removal, and ignores stale reads', async () => {
  const h = harness(), { ThemeToggle } = h.load('src/shared/layout/ThemeToggle.tsx')
  const button = h.add('#theme-toggle-btn'); h.add('.theme-icon')
  new ThemeToggle().setup(); new ThemeToggle().setup()
  assert.equal(h.watches.size, 1); assert.equal(button.count('click'), 1)
  const themeCount = h.themes.length
  button.isConnected = false; h.sweep(); h.reads[0]('dark'); await Promise.resolve()
  assert.equal(h.watches.size, 0); assert.equal(button.count('click'), 0); assert.equal(h.themes.length, themeCount)
})

test('sidebar storage completion cannot bind a removed owner', async () => {
  const h = harness(), { setupSidebarToggle } = h.load('src/shared/layout/sidebar.ts')
  const button = h.add('#sidebar-toggle'), root = h.add('.xzzdpro-root')
  const handle = h.add('#sidebar-resize-handle')
  const first = setupSidebarToggle(); await setupSidebarToggle()
  assert.equal(h.reads.length, 1)
  button.isConnected = false; root.isConnected = false; h.sweep(); h.reads[0]({ sidebarWidth: 350 }); await first
  assert.equal(button.count('click'), 0); assert.equal(handle.count('mousedown'), 0)
  assert.equal(root.style.getPropertyValue('--xzzd-sidebar-width'), '')
})

test('sidebar repeated setup and active drag cleanup release document listeners', async () => {
  const h = harness(), { setupSidebarToggle } = h.load('src/shared/layout/sidebar.ts')
  const button = h.add('#sidebar-toggle'), root = h.add('.xzzdpro-root'), handle = h.add('#sidebar-resize-handle')
  const setup = setupSidebarToggle(); h.reads[0]({}); await setup; await setupSidebarToggle()
  assert.equal(button.count('click'), 1); assert.equal(handle.count('mousedown'), 1)
  const down = new Event('mousedown'); Object.assign(down, { button: 0, clientX: 20 }); handle.dispatchEvent(down)
  assert.equal(h.document.count('mousemove'), 1)
  button.isConnected = false; h.sweep()
  assert.equal(h.document.count('mousemove'), 0); assert.equal(root.classList.contains('sidebar-resizing'), false)
})

test('resize setup binds once and clears active drag state on owner removal', () => {
  const h = harness(), { setupResizeHandlers } = h.load('src/shared/layout/resizeHandlers.ts')
  h.add('.xzzdpro-main'); const owner = h.add('.main-content-wrapper'), handle = h.add('.resize-handle-left')
  setupResizeHandlers(); setupResizeHandlers()
  assert.equal(handle.count('mousedown'), 1); assert.equal(h.document.count('mousemove'), 1)
  const event = new Event('mousedown'); Object.assign(event, { clientX: 10 }); handle.dispatchEvent(event)
  assert.equal(h.document.body.style.cursor, 'ew-resize')
  owner.isConnected = false; h.sweep()
  assert.equal(h.document.count('mousemove'), 0); assert.equal(h.document.count('mouseup'), 0)
  assert.equal(h.document.body.style.cursor, ''); assert.equal(h.document.body.style.userSelect, '')
})

test('rendered header, sidebar, and course detail HTML exactly match baseline fixtures', () => {
  const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/layout-html.json'), 'utf8'))
  const current = harness()
  const renderers = {
    header: current.load('src/shared/layout/header.tsx').renderHeader,
    sidebar: current.load('src/shared/layout/sidebar.ts').renderSidebar,
    courseDetail: current.load('src/shared/course-detail/courseDetailHelpers.ts').renderCourseDetailPage
  }
  for (const [name, render] of Object.entries(renderers)) {
    for (const { args, html } of fixtures[name]) {
      assert.equal(render(...args), html, name + ': ' + JSON.stringify(args))
    }
  }
})
