const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript")
const compile = (file) =>
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React
    }
  }).outputText
const htmlSource = compile("src/lib/html.ts"),
  overviewSource = compile("src/features/courses/courseOverviewBeautifier.tsx")
// Pure modules run for real; only DOM- and React-bound imports are stubbed.
function loadPure(file, deps) {
  const exports = {}
  vm.runInNewContext(compile(file), {
    exports,
    console,
    require: (n) => deps[n] || {}
  })
  return exports
}
function load() {
  const html = { exports: {} }
  // DOMPurify needs a DOM; the real escapeHtml is kept and sanitize is recorded instead.
  const sanitized = []
  vm.runInNewContext(htmlSource, {
    exports: html.exports,
    require: () => ({
      __esModule: true,
      default: {
        sanitize: (x) => {
          sanitized.push(x)
          return x
        },
        addHook() {}
      }
    }),
    HTMLAnchorElement: class {}
  })
  const exports = {}
  const stubs = {
    "@/lib/html": html.exports,
    "@/components/ui/badge": {
      badgeVariants: ({ variant }) => "badge-" + variant
    },
    "@/components/ui/todo-list": {
      getDeadlineInfo: (d) =>
        d === null
          ? null
          : { variant: d <= 3 ? "urgent" : "normal", text: `剩余 ${d} 天` }
    },
    "@/shared/course-detail/courseDetailHelpers": {
      mountCourseDetailPage: async () => null
    },
    "./overviewActivity": loadPure("src/features/courses/overviewActivity.ts", {
      "@/lib/nativePreview": loadPure("src/lib/nativePreview.ts", {}),
      "@/shared/api/todos": loadPure("src/shared/api/todos.ts", {})
    })
  }
  vm.runInNewContext(overviewSource, {
    exports,
    console,
    require: (name) => stubs[name] || {}
  })
  return { ...exports, sanitized }
}
const base = {
  id: 1,
  display_name: "信号与系统",
  name: "信号与系统",
  course_code: "C-1",
  start_date: null,
  department: { id: 1, code: "d", name: "信息学院" },
  semester: { id: 2, code: "s", name: "2025-2026秋冬" }
}

test("heading uses the course name and a department · semester subtitle", () => {
  const o = load()
  assert.equal(o.getCourseTitle(base), "信号与系统")
  assert.equal(
    o.getCourseTitle({ ...base, display_name: "", name: "" }),
    "课程概览"
  )
  assert.equal(o.getCourseSubtitle(base), "信息学院 · 2025-2026秋冬")
  assert.equal(
    o.getCourseSubtitle({ ...base, department: undefined }),
    "2025-2026秋冬"
  )
})

test("facts leave out the course name and empty fields instead of showing placeholders", () => {
  const o = load()
  const html = o.renderOverviewContent({
    ...base,
    course_attributes: { teaching_class_name: "  ", student_count: 0 }
  })
  assert.match(html, /<dt>课程代码<\/dt>/)
  assert.doesNotMatch(html, /课程名称|开始日期|授课班级|暂无信息/)
  assert.match(html, /<dt>选课人数<\/dt>\s*<dd>0 人<\/dd>/)
})

test("plain-text descriptions become escaped paragraphs; HTML descriptions are sanitized", () => {
  const o = load()
  const plain = o.renderOverviewContent({
    ...base,
    course_outline: {
      common_fields: [
        {
          key: "comment_chinese",
          title: "",
          description: "第一段 a<b\n\n第二段"
        }
      ]
    }
  })
  assert.match(plain, /<p>第一段 a&lt;b<\/p><p>第二段<\/p>/)
  assert.equal(o.sanitized.length, 0)
  const rich = load()
  rich.renderOverviewContent({
    ...base,
    course_outline: {
      common_fields: [
        { key: "comment_chinese", title: "", description: "<p>富文本</p>" }
      ]
    }
  })
  assert.deepEqual(rich.sanitized, ["<p>富文本</p>"])
})

test("English is secondary, labelled only alongside Chinese, and hidden when missing", () => {
  const o = load()
  const zh = [{ key: "comment_chinese", title: "", description: "中文" }],
    en = [{ key: "comment_english", title: "", description: "English text" }]
  assert.doesNotMatch(
    o.renderOverviewContent({ ...base, course_outline: { common_fields: zh } }),
    /lang="en"/
  )
  const both = o.renderOverviewContent({
    ...base,
    course_outline: { common_fields: [...zh, ...en] }
  })
  assert.match(both, /lang="en"[\s\S]*overview-subtitle">English</)
  assert.doesNotMatch(
    o.renderOverviewContent({ ...base, course_outline: { common_fields: en } }),
    /overview-subtitle/
  )
  assert.match(o.renderOverviewContent(base), /暂未填写课程简介/)
})

test("teachers fall back to an escaped initial and only show an email when present", () => {
  const o = load()
  const html = o.renderOverviewContent({
    ...base,
    instructors: [
      { id: 1, name: "<李>老师", avatar_small_url: "https://x/a.png" },
      { id: 2, name: "王老师", email: "w@x.cn" }
    ]
  })
  assert.match(html, /<span>&lt;<\/span>/)
  assert.match(
    html,
    /<img src="https:\/\/x\/a.png" alt="" loading="lazy" onerror="this.remove\(\)" \/>/
  )
  assert.match(html, /mailto:w@x.cn/)
  assert.equal((html.match(/overview-teacher-email/g) || []).length, 1)
  assert.match(
    o.renderOverviewContent({ ...base, instructors: [] }),
    /暂无教师信息/
  )
})

test("pending list escapes titles, shows the deadline badge, and caps at six rows", () => {
  const o = load()
  assert.match(o.renderPendingBody(null), /加载失败/)
  assert.match(o.renderPendingBody([]), /暂无待完成事项/)
  const item = (i, days) => ({
    id: i,
    title: "<作业" + i + ">",
    typeName: "作业",
    link: "https://x/" + i,
    deadlineText: days === null ? null : "10.30 23:59",
    daysLeft: days
  })
  const html = o.renderPendingBody([item(1, 2), item(2, null)])
  assert.match(html, /&lt;作业1&gt;/)
  assert.match(
    html,
    /作业 · 截止 10.30 23:59[\s\S]*badge-urgent[^"]*">剩余 2 天/
  )
  assert.match(html, /作业 · 无截止时间/)
  assert.equal((html.match(/badge-/g) || []).length, 1)
  const many = o.renderPendingBody(
    Array.from({ length: 8 }, (_, i) => item(i, 10))
  )
  assert.equal((many.match(/<li /g) || []).length, 6)
  assert.match(many, /另有 2 项未显示/)
})

test("recent list opens files in a new tab with activity and relative time", () => {
  const o = load()
  assert.match(o.renderRecentBody(null), /课件加载失败/)
  assert.match(o.renderRecentBody([]), /暂未发布课件/)
  const now = new Date(2026, 9, 29, 12)
  const html = o.renderRecentBody(
    [
      {
        id: 1,
        name: "讲义<1>.pdf",
        activityTitle: "第一章",
        link: "https://x/1",
        time: new Date(2026, 9, 28)
      },
      {
        id: 2,
        name: "无时间.pdf",
        activityTitle: "",
        link: "https://x/2",
        time: null
      }
    ],
    now
  )
  assert.match(html, /target="_blank" rel="noopener noreferrer"/)
  assert.match(html, /讲义&lt;1&gt;.pdf[\s\S]*第一章 · 昨天/)
  assert.equal((html.match(/overview-row-meta/g) || []).length, 1)
})

test("activity cards render with loading rows and a courseware link for the course", () => {
  const o = load()
  const html = o.renderOverviewContent(base, "456")
  assert.match(html, /id="overview-pending"[\s\S]*aria-busy="true"/)
  assert.match(
    html,
    /href="https:\/\/courses.zju.edu.cn\/course\/456\/courseware#\/">全部课件/
  )
})
