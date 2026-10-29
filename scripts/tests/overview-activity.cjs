const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript")
const compile = (file) =>
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText
function load() {
  const mod = (file, require) => {
    const exports = {}
    vm.runInNewContext(compile(file), { exports, require, console })
    return exports
  }
  const native = mod("src/lib/nativePreview.ts", () => ({}))
  const todos = mod("src/shared/api/todos.ts", () => ({}))
  return mod("src/features/courses/overviewActivity.ts", (name) =>
    name.endsWith("nativePreview")
      ? native
      : name.endsWith("/todos")
        ? todos
        : {}
  )
}
const now = new Date(2026, 9, 29, 12, 0)

test("pending keeps only this course and sorts by deadline, undated last", () => {
  const o = load()
  const todos = [
    {
      id: 1,
      course_id: 7,
      type: "homework",
      title: "晚",
      end_time: new Date(2026, 10, 5, 23, 59).toISOString()
    },
    {
      id: 2,
      course_id: 8,
      type: "homework",
      title: "别的课",
      end_time: new Date(2026, 9, 30).toISOString()
    },
    { id: 3, course_id: 7, type: "exam", title: "无截止", end_time: "" },
    {
      id: 4,
      course_id: 7,
      type: "questionnaire",
      title: "早",
      end_time: new Date(2026, 9, 30, 23, 59).toISOString()
    },
    { id: 5, course_id: 7, type: "vote", title: "也无截止", end_time: null }
  ]
  const items = o.pendingForCourse(todos, "7", now)
  assert.deepEqual(
    items.map((i) => i.title),
    ["早", "晚", "无截止", "也无截止"]
  )
  assert.equal(items[0].typeName, "问卷")
  assert.equal(items[0].deadlineText, "10.30 23:59")
  assert.equal(items[0].daysLeft, 2)
  assert.equal(items[2].deadlineText, null)
  assert.equal(items[2].daysLeft, null)
  assert.equal(
    items[2].link,
    "https://courses.zju.edu.cn/course/7/learning-activity#/exam/3"
  )
  assert.equal(
    o.pendingForCourse(
      [
        {
          id: 9,
          course_id: 7,
          type: "homework",
          title: "跨年",
          end_time: new Date(2027, 0, 3, 8, 0).toISOString()
        }
      ],
      7,
      now
    )[0].deadlineText,
    "2027.01.03 08:00"
  )
})

test("recent files are newest first, fall back to activity time, skip unstarted, and cap the count", () => {
  const o = load()
  const activities = [
    {
      id: 10,
      title: "第一章",
      is_started: true,
      created_at: new Date(2026, 8, 1).toISOString(),
      uploads: [
        {
          id: 1,
          name: "a.pdf",
          created_at: new Date(2026, 9, 20).toISOString()
        },
        { id: 2, name: "b.pdf" }
      ]
    },
    {
      id: 11,
      title: "未开放",
      is_started: false,
      uploads: [
        {
          id: 3,
          name: "hidden.pdf",
          created_at: new Date(2026, 9, 28).toISOString()
        }
      ]
    },
    {
      id: 12,
      title: "第二章",
      is_started: true,
      updated_at: new Date(2026, 9, 27).toISOString(),
      uploads: [
        { id: 4, name: "c.pptx" },
        { id: 5, name: "d.pdf", created_at: "not a date" }
      ]
    },
    { id: 13, title: "无时间", uploads: [{ id: 6, name: "e.pdf" }] }
  ]
  const files = o.recentUploads(activities, 7, 10)
  assert.deepEqual(
    files.map((f) => f.name),
    ["c.pptx", "d.pdf", "a.pdf", "b.pdf", "e.pdf"]
  )
  assert.equal(
    files[0].link,
    "https://courses.zju.edu.cn/course/7/learning-activity?xzzdpro-native=1#/12"
  )
  assert.equal(files.at(-1).time, null)
  assert.equal(o.recentUploads(activities, 7, 2).length, 2)
})

test("relative days count calendar days", () => {
  const o = load()
  assert.equal(o.formatRelativeDay(new Date(2026, 9, 29, 0, 5), now), "今天")
  assert.equal(o.formatRelativeDay(new Date(2026, 9, 28, 23, 59), now), "昨天")
  assert.equal(o.formatRelativeDay(new Date(2026, 9, 24), now), "5 天前")
  assert.equal(o.formatRelativeDay(new Date(2026, 9, 2), now), "2026.10.02")
})
