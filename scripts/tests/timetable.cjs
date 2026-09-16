const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')

function load(file, globals = {}, extra = '') {
  const exports = {}
  const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8') + extra
  const code = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
  } }).outputText
  vm.runInNewContext(code, { exports, URL, URLSearchParams, console, ...globals })
  return exports
}
function response(status, url, body) {
  return { status, ok: status >= 200 && status < 300, url,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body), json: async () => body }
}
const timetableUrl = 'https://zdbk.zju.edu.cn/jwglxt/kbcx/xskbcx_cxXsKb.html'
const ssoUrl = 'https://zjuam.zju.edu.cn/cas/login?service=zdbk'
function harness(finalResponse) {
  const calls = [], errors = []
  const access = load('src/background/timetableAccess.ts', {
    fetch: async (url, options) => {
      calls.push({ url, options })
      if (calls.length === 1) return response(200, timetableUrl, { ssologinurl: ssoUrl })
      return finalResponse
    }
  })
  const backend = load('src/background/messages/get-courses.ts', {
    fetch: async () => finalResponse,
    require: () => access,
    console: { log() {}, warn() {}, error: (...args) => errors.push(args) }
  }, '\nexport { requestTimetable, getTimetableResponse }; export function setFetch(f: any) { fetchTimetable = f; }')
  return { access, backend, calls, errors }
}

test('901 is a recoverable access failure, without an unsupported VPN diagnosis', async () => {
  const h = harness(response(901, timetableUrl, ''))
  await assert.rejects(h.backend.requestTimetable(new URLSearchParams(), timetableUrl), error =>
    error.code === 'unavailable' && error.status === 901 && !/VPN/.test(error.message))
  assert.equal(h.errors.length, 0)
})
test('SSO login page and a successful 200 response at ZDBK are distinct states', async () => {
  const login = harness(response(200, ssoUrl, 'login'))
  assert.equal(await login.access.performBackgroundLogin(), 'login_required')
  const success = harness(response(200, 'https://zdbk.zju.edu.cn/jwglxt/xtgl/index_initMenu.html', 'home'))
  assert.equal(await success.access.performBackgroundLogin(), 'ok')
  assert.equal(success.calls.length, 2)
  assert.equal(success.calls[1].options.redirect, 'follow')
})
test('SSO service error is unavailable, not login required or success', async () => {
  const h = harness(response(503, timetableUrl, 'unavailable'))
  assert.equal(await h.access.performBackgroundLogin(), 'unavailable')
})
test('HTML login pages are distinguished from malformed timetable data', async () => {
  const login = harness(response(200, timetableUrl, '<form><input type="password"></form>'))
  await assert.rejects(login.backend.requestTimetable(new URLSearchParams(), timetableUrl), e => e.code === 'login_required')
  const bad = harness(response(200, timetableUrl, { message: 'gateway error' }))
  await assert.rejects(bad.backend.requestTimetable(new URLSearchParams(), timetableUrl), e => e.code === 'invalid_response')
  const empty = harness(response(200, timetableUrl, { kbList: [] }))
  assert.equal((await empty.backend.requestTimetable(new URLSearchParams(), timetableUrl)).kbList.length, 0)
})
test('network failures never trigger login; access recovery retries only once', async () => {
  const offline = harness(null)
  offline.backend.setFetch(async () => { throw new TypeError('offline') })
  assert.equal((await offline.backend.getTimetableResponse('123')).status, 'error')
  assert.equal(offline.calls.length, 0)
  const h = harness(response(200, timetableUrl, 'home'))
  let attempts = 0
  h.backend.setFetch(async () => {
    attempts++
    throw new h.access.TimetableRequestError('901', 'unavailable', 901)
  })
  assert.equal((await h.backend.getTimetableResponse('123')).status, 'error')
  assert.equal(attempts, 2)
})
test('concurrent requests share one operation and are not cached after completion', async () => {
  const h = harness(null)
  let resolve, attempts = 0
  h.backend.setFetch(() => { attempts++; return new Promise(r => { resolve = r }) })
  const replies = []
  const first = h.backend.default({ body: { studentId: '123' } }, { send: value => replies.push(value) })
  const second = h.backend.default({ body: { studentId: '123' } }, { send: value => replies.push(value) })
  assert.equal(attempts, 1)
  resolve({ kbList: [] }); await Promise.all([first, second])
  assert.equal(replies.length, 2)
  const third = h.backend.default({ body: { studentId: '123' } }, { send() {} })
  assert.equal(attempts, 2); resolve({ kbList: [] }); await third
})
test('development port disconnect consumes lastError and reports unexpected failures', () => {
  let callback, reads = 0, message = 'The page keeping the extension port is moved into back/forward cache, so the message channel is closed.'
  const errors = []
  const runtime = { get lastError() { reads++; return { message } } }
  const { handleDevelopmentPort } = load('src/background/developmentPorts.ts', {
    chrome: { runtime }, console: { error: (...args) => errors.push(args) }
  })
  handleDevelopmentPort({ name: '__plasmo_runtime_script_test', onDisconnect: { addListener: fn => { callback = fn } } })
  callback(); assert.equal(reads, 1); assert.equal(errors.length, 0)
  message = 'Unexpected failure'; callback(); assert.equal(errors.length, 1)
  callback = null
  handleDevelopmentPort({ name: 'business', onDisconnect: { addListener: fn => { callback = fn } } })
  assert.equal(callback, null)
})
