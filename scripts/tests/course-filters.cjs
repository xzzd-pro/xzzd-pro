const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript")
const source = ts.transpileModule(
  fs.readFileSync("src/features/courses/course-filters.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText
function load(fetch, sessionStorage) {
  const exports = {}
  vm.runInNewContext(source, { exports, fetch, console, sessionStorage })
  return exports
}
test("academic semesters are chronological across school years and calendar years", () => {
  const { semesterOrder: r } = load()
  assert.ok(r("2025-2026春夏学期") > r("2025-2026秋冬学期"))
  assert.ok(r("2026年秋学期") > r("2025-2026春夏学期"))
  assert.ok(r("2025-2026第一学期") < r("2025-2026第二学期"))
  assert.equal(r("2025-2026学年"), null)
  assert.equal(r("其他课程"), null)
})
// Semesters as the course list API reports them: label in `code`, name null.
const listed = (id, code) => ({ id, code, name: null, real_name: null })
const noFetch = async () => {
  throw new Error("semester options must not fetch")
}

test("catalog reads semesters from the course list without any requests", () => {
  const api = load(noFetch)
  const result = api.collectCourseSemesters([
    { id: 1, semester: listed(78, "2025-2026秋冬") },
    { id: 2, semester: listed(78, "2025-2026秋冬") },
    { id: 3, semester: listed(80, "2025-2026春") },
    { id: 4, semester: { id: 76, code: "x", name: "2025-2026秋" } }
  ])
  assert.equal(result.options.length, 2)
  assert.equal(result.latestId, "2025:spring")
  assert.equal(result.warning, "")
  assert.equal(result.courseSemesters.get(2), "78")
  assert.equal(result.courseSemesterNames.get(3), "2025-2026春")
  // A filled-in name wins over the code.
  assert.equal(result.courseSemesterNames.get(4), "2025-2026秋")
})

test("courses without a semester are left out; unclear names choose no default", () => {
  const api = load(noFetch)
  const result = api.collectCourseSemesters([
    { id: 1, semester: null },
    { id: 2 },
    { id: 3, semester: listed(9, "") },
    { id: 4, semester: listed(84, "2026-2027冬") }
  ])
  assert.deepEqual([...result.courseSemesters.keys()], [4])
  assert.equal(result.latestId, "2026:autumn")
  const ambiguous = api.collectCourseSemesters([
    { id: 5, semester: listed(3, "长期课程") }
  ])
  assert.equal(ambiguous.latestId, "")
  assert.match(ambiguous.warning, /无法确定最近学期/)
  assert.match(
    api.collectCourseSemesters([{ id: 6, semester: null }]).warning,
    /未提供学期信息/
  )
})

test("semester halves group split terms and keep different academic years separate", () => {
  const names = [
    "2026-2027秋冬",
    "2026-2027秋",
    "2026-2027冬",
    "2025-2026春夏",
    "2025-2026春",
    "2025-2026夏",
    "2025-2026秋冬"
  ]
  const api = load(noFetch)
  const courses = names.map((name, id) => ({
    id,
    name: "信号 " + id,
    display_name: "信号 " + id,
    instructors: [{ name: "教师" }],
    semester: listed(id, name)
  }))
  const catalog = api.collectCourseSemesters(courses)
  assert.equal(catalog.options.length, 3)
  assert.equal(catalog.latestId, "2026:autumn")
  const latest = catalog.options.find((o) => o.id === catalog.latestId)
  assert.equal(latest.semesterIds.length, 3)
  const statuses = new Map(
    courses.map((c) => [c.id, new Set([c.id === 0 ? "ongoing" : "closed"])])
  )
  let selected = api.filterCourses(
    courses,
    {
      keyword: "",
      status: api.COURSE_STATUSES,
      semester_id: latest.semesterIds
    },
    catalog.courseSemesters,
    statuses
  )
  assert.equal(selected.length, 3)
  selected = api.filterCourses(
    courses,
    { keyword: "教师", status: ["ongoing"], semester_id: latest.semesterIds },
    catalog.courseSemesters,
    statuses
  )
  assert.equal(selected.length, 1)
  assert.equal(selected[0].id, 0)
  assert.equal(
    api.filterCourses(
      courses,
      { keyword: "", status: api.COURSE_STATUSES, semester_id: [] },
      catalog.courseSemesters,
      statuses
    ).length,
    7
  )
})
