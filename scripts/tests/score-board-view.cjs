const assert = require("node:assert/strict")
const { test } = require("node:test")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")
const fixture = require("../preview/score-fixture.json")

function load(relative) {
  const filename = path.resolve(__dirname, "../../src/features/score-board/components", relative)
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 }
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require(name) {
    if (name === "react") return React
    if (name === "./scoreBoardStyles") return load("scoreBoardStyles.ts")
    throw new Error(`Unexpected view dependency: ${name}`)
  } })
  return exports
}
const { ScoreBoardView } = load("ScoreBoardView.tsx")
function render(data) { return renderToStaticMarkup(React.createElement(ScoreBoardView, { data })) }

test("fixture renders published performance and server supplied homework without inventing a total", () => {
  const html = render(fixture)
  assert.match(html, />92<\/strong>/)
  assert.match(html, /第一章 · 线性系统与数学模型/)
  assert.match(html, /推导完整，分析清晰。/)
  assert.match(html, /最终成绩/)
  assert.equal((html.match(/>未公布<\/span>/g) || []).length, 2)
  assert.doesNotMatch(html, /加权|预测|总分.*\d+/)
})

test("unannounced performance never exposes a supplied numeric score", () => {
  const data = structuredClone(fixture)
  data.performanceScore.announce_score_setting = "no_announce"
  data.performanceScore.score = 987.654
  const html = render(data)
  assert.doesNotMatch(html, /987\.654/)
  assert.match(html, /<strong>—<\/strong>/)
})

test("zero remains a score and missing values stay unavailable", () => {
  const data = structuredClone(fixture)
  data.performanceScore.score = 0
  data.customScoreItems[0].score = "0"
  data.homeworkScores.scores[0].score = "0"
  data.homeworkScores.scores[1].score = ""
  const html = render(data)
  assert.match(html, /<strong>0<\/strong>/)
  assert.equal((html.match(/class="score-board-value">0<\/span>/g) || []).length, 2)
  assert.equal((html.match(/class="score-board-value">—<\/span>/g) || []).length, 3)
})

test("empty and unavailable responses render compact explicit states", () => {
  const data = { announceSettings: null, performanceScore: null, customScoreItems: [], homeworkScores: null, examScores: null,
    exams: [], forumScores: [], classroomScores: [], questionnaireScores: [], rollcalls: [] }
  const html = render(data)
  for (const message of ["无法获取总成绩信息", "无法获取课堂表现信息", "暂无自定义成绩项", "暂无作业成绩", "暂无考勤记录"]) assert(html.includes(message))
  assert.doesNotMatch(html, /undefined|NaN/)
})
