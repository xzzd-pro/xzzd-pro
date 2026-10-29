const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript")

const source = ts.transpileModule(
  fs.readFileSync("src/shared/api/load-error.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText
const mod = {}
vm.runInNewContext(source, { exports: mod, Error, TypeError })
const { LoadError, describeLoadError } = mod

test("expired logins are told to sign in again", () => {
  for (const status of [401, 403]) {
    assert.match(
      describeLoadError(new LoadError("x", status), "公告"),
      /^公告加载失败：登录已失效/
    )
  }
})

test("other HTTP errors show the status", () => {
  assert.equal(
    describeLoadError(new LoadError("x", 502), "课程"),
    "课程加载失败（HTTP 502），请稍后重试。"
  )
})

test("errors without a status keep their explanation", () => {
  assert.equal(
    describeLoadError(new LoadError("无法确定当前用户。"), "公告"),
    "公告加载失败：无法确定当前用户。"
  )
})

test("network failures point at the connection", () => {
  assert.match(
    describeLoadError(new TypeError("Failed to fetch"), "课程"),
    /无法连接学在浙大/
  )
  assert.equal(describeLoadError("??", "课程"), "课程加载失败，请稍后重试。")
})
