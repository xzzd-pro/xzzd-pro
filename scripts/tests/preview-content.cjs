const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, globals = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText, { exports, URL, URLSearchParams, AbortSignal, TextDecoder, ...globals })
  return exports
}
const { decodeText } = load('src/assistant/services/textDecode.ts')

test('native preview requests the school endpoint with activity context and fresh credentials', async () => {
  const requests = []
  const api = load('src/lib/nativePreview.ts', { fetch: async (url, options) => {
    requests.push({ url, options })
    return { ok: true, json: async () => ({ preview_url: 'https://course-wps.zju.edu.cn/weboffice/office/f/123?readonly=true' }) }
  } })
  for (let i = 0; i < 2; i++) {
    assert.match(await api.fetchNativePreviewUrl('https://courses.zju.edu.cn/api/uploads/123/blob', api.nativeActivityUrl(1, 456)), /^https:\/\/course-wps.zju.edu.cn\//)
  }
  assert.equal(requests.length, 2)
  const url = new URL(requests[0].url)
  assert.equal(url.pathname, '/api/uploads/123/preview/private-wps')
  assert.equal(url.searchParams.get('refer_id'), '456')
  assert.equal(url.searchParams.get('refer_type'), 'learning_activity')
  assert.equal(url.searchParams.get('preview'), 'true')
  assert.equal(requests[0].options.credentials, 'include')
  assert.equal(requests[0].options.cache, 'no-store')
})

test('native preview rejects denied, missing, malformed and foreign preview URLs', async () => {
  for (const response of [
    { ok: false, status: 403 },
    { ok: true, json: async () => ({}) },
    { ok: true, json: async () => { throw new Error('HTML login page') } },
    { ok: true, json: async () => ({ preview_url: 'javascript:alert(1)' }) },
    { ok: true, json: async () => ({ preview_url: 'https://example.com/preview' }) }
  ]) {
    const api = load('src/lib/nativePreview.ts', { fetch: async () => response })
    await assert.rejects(api.fetchNativePreviewUrl('https://courses.zju.edu.cn/api/uploads/123/blob', api.nativeActivityUrl(1, 456)))
  }
  const api = load('src/lib/nativePreview.ts', { fetch: () => { throw new Error('must not fetch') } })
  await assert.rejects(api.fetchNativePreviewUrl('https://example.com/api/uploads/123/blob', api.nativeActivityUrl(1, 456)), /无法确定/)
})

test('preview reserves one tab, closes on failure and allows retry', async () => {
  const exports = {}, tabs = []
  let rejectRequest, resolveRequest, requests = 0
  const react = {
    useState: (value) => [value, () => {}], useRef: (value) => ({ current: value }),
    createElement: (type, props, ...children) => ({ type, props, children })
  }
  const code = ts.transpileModule(fs.readFileSync('src/components/ui/native-preview-button.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React }
  }).outputText
  vm.runInNewContext(code, { exports, Error, window: { open() {
    const tab = { closed: false, opener: {}, close() { this.closed = true }, location: { replace(url) { tab.url = url } } }
    tabs.push(tab)
    return tab
  } }, require(name) {
    if (name === 'react') return react
    if (name.endsWith('/nativePreview')) return { fetchNativePreviewUrl() {
      requests++
      return new Promise((resolve, reject) => { resolveRequest = resolve; rejectRequest = reject })
    } }
    return {}
  } })
  const tree = exports.NativePreviewButton({ fileUrl: 'file', activityUrl: 'activity' })
  const click = tree.children[0].props.onClick
  const first = click()
  await click()
  assert.equal(requests, 1)
  assert.equal(tabs.length, 1)
  assert.equal(tabs[0].opener, null)
  rejectRequest(new Error('HTTP 403'))
  await first
  assert.equal(tabs[0].closed, true)
  const second = click()
  resolveRequest('https://course-wps.zju.edu.cn/preview')
  await second
  assert.equal(requests, 2)
  assert.equal(tabs[1].url, 'https://course-wps.zju.edu.cn/preview')
})
test('text previews decode UTF-8, GBK and BOM-marked UTF-16', () => {
  assert.equal(decodeText(Buffer.from('中文\ntext')), '中文\ntext')
  assert.equal(decodeText(Uint8Array.from([0xd6, 0xd0, 0xce, 0xc4])), '中文')
  assert.equal(decodeText(Uint8Array.from([0xff, 0xfe, 0x2d, 0x4e, 0x87, 0x65])), '中文')
  assert.equal(decodeText(Uint8Array.from([0xfe, 0xff, 0x4e, 0x2d, 0x65, 0x87])), '中文')
  assert.equal(decodeText(new Uint8Array()), '')
})
test('native links retain activity routes and existing query parameters', () => {
  const api = load('src/lib/nativePreview.ts')
  const url = api.nativeActivityUrl(12, 34)
  assert.equal(new URL(url).hash, '#/34')
  assert.equal(api.isNativePreviewPage(url), true)
  const current = api.nativeCurrentPageUrl('https://courses.zju.edu.cn/course/12/learning-activity?foo=bar#/34')
  assert.equal(new URL(current).searchParams.get('foo'), 'bar')
  assert.equal(new URL(current).hash, '#/34')
  assert.equal(api.isNativePreviewPage('https://courses.zju.edu.cn/'), false)
})

test('restricted files and DOC never fetch file bytes; TXT uses strict text reader', async () => {
  const code = ts.transpileModule(fs.readFileSync('src/components/ui/file-preview-modal.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React }
  }).outputText
  for (const [fileName, canDownload, expected] of [
    ['restricted.pdf', false, 0], ['restricted.txt', false, 0],
    ['restricted.png', false, 0], ['legacy.doc', true, 0], ['notes.txt', true, 1]
  ]) {
    const exports = {}, effects = [], reads = []
    const react = {
      useState: (initial) => [initial, () => {}],
      useEffect: (callback) => effects.push(callback),
      createElement: (type, props, ...children) => ({ type, props, children })
    }
    vm.runInNewContext(code, {
      exports, window: { location: { href: 'https://courses.zju.edu.cn/course/1/learning-activity#/2' } },
      document: { body: { style: {} }, addEventListener() {}, removeEventListener() {} },
      require(name) {
        if (name === 'react') return react
        if (name === 'react-dom') return { createPortal: (x) => x }
        if (name.endsWith('/nativePreview')) return load('src/lib/nativePreview.ts')
        if (name.endsWith('/fileService')) return {
          fetchTextContent: async () => { reads.push('text'); return '中文' },
          fetchFileContent: async () => { reads.push('office'); return '' },
          fetchPdfBlob: async () => { reads.push('pdf'); return null }
        }
        if (name.endsWith('/utils')) return { cn: () => '' }
        return {}
      }
    })
    exports.FilePreviewModal({ isOpen: true, onClose() {}, fileName, canDownload, fileUrl: 'https://school/file' })
    effects.forEach((effect) => effect())
    await Promise.resolve()
    assert.equal(reads.length, expected, fileName)
    if (expected) assert.equal(reads[0], 'text')
  }
})
