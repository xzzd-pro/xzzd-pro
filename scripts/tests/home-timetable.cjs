const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const assert = require('node:assert/strict'), { test } = require('node:test'), ts = require('typescript')
function harness() {
  const sends = [], renders = [], intervals = new Set(), errors = []
  const detail = { textContent: '' }
  const container = { isConnected: true, innerHTML: '', querySelector: () => detail }
  const window = new EventTarget()
  window.open = () => ({ closed: false, close() { this.closed = true } })
  let bound = false
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/features/home/indexPageBeautifier.tsx'), 'utf8') + '\nexport { loadAndRenderCourses };'
  const exports = {}
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText
  vm.runInNewContext(code, {
    exports, window, document: { querySelector: () => container },
    console: { log() {}, warn() {}, debug() {}, error: (...args) => errors.push(args) },
    setInterval(fn) { intervals.add(fn); return fn }, clearInterval(fn) { intervals.delete(fn) },
    require(name) {
      if (name === 'react') return { createElement: (_type, props) => props }
      if (name === 'react-dom/client') return { createRoot: () => ({ render: x => renders.push(x), unmount() {} }) }
      if (name === '@plasmohq/messaging') return { sendToBackground: () => new Promise((resolve, reject) => sends.push({ resolve, reject })) }
      if (name === '@/shared/api/myCoursesApi') return { createMyCoursesPayload: x => x, fetchMyCoursesResponse: async () => ({ ok: true, json: async () => ({ courses: [] }) }) }
      if (name === '@/shared/layout/bindings') return { bindLayoutControl() {
        if (bound) return null; bound = true
        return { signal: new AbortController().signal, onCleanup() {} }
      } }
      return {}
    }
  })
  return { load: exports.loadAndRenderCourses, sends, intervals, renders, errors, detail, window }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
test('homepage polling is single flight and stops on service errors', async () => {
  const h = harness(), first = h.load('123')
  assert.equal(h.load('123'), first); assert.equal(h.sends.length, 1)
  h.sends[0].resolve({ status: 'login_required' }); await first
  assert.equal(h.intervals.size, 1)
  const poll = [...h.intervals][0]; poll(); poll()
  assert.equal(h.sends.length, 2)
  h.sends[1].resolve({ status: 'error', message: '服务不可用' }); await tick()
  assert.equal(h.intervals.size, 0); assert.equal(h.detail.textContent, '服务不可用')
})
test('bfcache suspension ignores the old reply and refreshes once on restore', async () => {
  const h = harness(), first = h.load('123')
  h.window.dispatchEvent(new Event('pagehide'))
  h.sends[0].resolve({ status: 'login_required' }); await first
  assert.equal(h.intervals.size, 0)
  const restored = new Event('pageshow'); restored.persisted = true
  h.window.dispatchEvent(restored); await tick()
  assert.equal(h.sends.length, 2)
  h.sends[1].resolve({ status: 'ok', data: { kbList: [] } }); await tick()
  assert.equal(h.renders.at(-1).loading, false)
})
test('message rejection is handled and does not leave an unhandled promise', async () => {
  const h = harness(), first = h.load('123')
  h.sends[0].reject(new Error('message channel is closed'))
  await first
  assert.equal(h.errors.length, 0)
  assert.match(h.detail.textContent, /连接已中断/)
})
