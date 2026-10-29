const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript")
const source = ts.transpileModule(
  fs.readFileSync("src/features/bulletin/splitRatio.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText
function load() {
  const exports = {}
  vm.runInNewContext(source, { exports })
  return exports
}

test("saved ratios are clamped and bad values fall back to an even split", () => {
  const s = load()
  assert.equal(s.clampSplitRatio(0.6), 0.6)
  assert.equal(s.clampSplitRatio(0.05), s.SPLIT_MIN)
  assert.equal(s.clampSplitRatio(0.99), s.SPLIT_MAX)
  for (const bad of [undefined, null, "abc", NaN, Infinity])
    assert.equal(s.clampSplitRatio(bad), s.SPLIT_DEFAULT)
  assert.equal(s.clampSplitRatio("0.4"), 0.4)
})

test("pointer position maps to the unread column share around the handle center", () => {
  const s = load()
  const box = { left: 100, width: 1024 }
  // Handle centered in the middle of the container: even split.
  assert.equal(s.ratioFromPointer(100 + 512, box), 0.5)
  // A quarter of the free width (excluding the 24px handle) to the left.
  assert.equal(s.ratioFromPointer(100 + 12 + 250, box), 0.25)
  // Dragging past either edge stays within the allowed range.
  assert.equal(s.ratioFromPointer(0, box), s.SPLIT_MIN)
  assert.equal(s.ratioFromPointer(5000, box), s.SPLIT_MAX)
  // A container too narrow for the handle keeps the default.
  assert.equal(s.ratioFromPointer(10, { left: 0, width: 20 }), s.SPLIT_DEFAULT)
})

test("grid columns keep both cards shrinkable around a fixed handle", () => {
  const s = load()
  assert.equal(s.splitColumns(0.5), "minmax(0, 0.5fr) 24px minmax(0, 0.5fr)")
  assert.equal(s.splitColumns(0.9), "minmax(0, 0.75fr) 24px minmax(0, 0.25fr)")
})
