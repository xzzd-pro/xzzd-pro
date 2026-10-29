const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  ts = require("typescript")

const source = ts.transpileModule(
  fs.readFileSync("src/lib/class-times.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText
const mod = { exports: {} }
new Function("module", "exports", source)(mod, mod.exports)
const { formatClassTimes } = mod.exports

test("consecutive periods become a range per weekday", () => {
  assert.deepEqual(
    formatClassTimes("周二第3,4,5节;周四第3,4节;周五第11,12节"),
    ["周二 3–5 节", "周四 3–4 节", "周五 11–12 节"]
  )
})

test("single and non-consecutive periods stay readable", () => {
  assert.deepEqual(formatClassTimes("周三第9节"), ["周三 9 节"])
  assert.deepEqual(formatClassTimes("周一第1,2,4节"), ["周一 1–2,4 节"])
})

test("full-width separators and stray spaces are accepted", () => {
  assert.deepEqual(formatClassTimes(" 周一第6，7，8节 ； 周三第1,2节 "), [
    "周一 6–8 节",
    "周三 1–2 节"
  ])
})

test("text that is not a weekday slot is kept as written", () => {
  assert.deepEqual(formatClassTimes("教学班一"), ["教学班一"])
  assert.deepEqual(formatClassTimes(""), [])
  assert.deepEqual(formatClassTimes(null), [])
})
