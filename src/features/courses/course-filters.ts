export const COURSE_STATUSES = ["ongoing", "notStarted", "closed"]

export interface CourseFilters {
  keyword: string
  status: string[]
  semester_id: string[]
}

export interface SemesterOption {
  id: string
  name: string
  semesterIds: string[]
}

// Academic years begin in autumn; calendar-year labels begin in spring.
/**
 * Converts a semester name into a sortable number (four terms per year).
 * @param name Semester name, e.g. "2025-2026学年秋冬" or "2026春".
 * @returns Sort key, or null if no year is found.
 */
export function semesterOrder(name: string): number | null {
  const years = name.match(/(?:19|20)\d{2}/g)
  if (!years) return null
  const academic = years.length > 1 || name.includes("学年")
  let term: number | undefined
  if (/秋|第一学期|第1学期|上学期/.test(name)) term = academic ? 0 : 2
  else if (/冬/.test(name)) term = academic ? 1 : 3
  else if (/春|第二学期|第2学期|下学期/.test(name)) term = academic ? 2 : 0
  else if (/夏|第三学期|第3学期/.test(name)) term = academic ? 3 : 1
  if (term === undefined) return null
  // Convert academic-year spring/summer to the following calendar year.
  const year = Number(years[0]) + (academic && term >= 2 ? 1 : 0)
  const season = academic ? (term + 2) % 4 : term
  return year * 4 + season
}

/** The semester as the course list API reports it; `name` is usually null there. */
export interface ListedSemester {
  id: string | number
  code?: string | null
  name?: string | null
}

/**
 * Builds the semester filter options from the semesters the course list
 * already includes, so no per-course requests are needed.
 *
 * The list API leaves `semester.name` null and puts the label in `code`
 * ("2026-2027冬"), which equals the name the course detail API returns.
 * Courses without a semester are left out of every semester option.
 * @param courses Courses from the course list API.
 * @returns Filter options newest first, the id of the latest option, a warning when no default can be chosen, and each course's semester id and name.
 */
export function collectCourseSemesters(
  courses: { id: number; semester?: ListedSemester | null }[]
): {
  options: SemesterOption[]
  latestId: string
  warning: string
  courseSemesters: Map<number, string>
  courseSemesterNames: Map<number, string>
} {
  const options = new Map<string, SemesterOption>()
  const courseSemesters = new Map<number, string>()
  const courseSemesterNames = new Map<number, string>()
  for (const course of courses) {
    const semester = course.semester
    const name = (semester?.name || semester?.code || "").trim()
    if (
      !semester ||
      (typeof semester.id !== "number" && typeof semester.id !== "string") ||
      !name
    )
      continue
    const id = String(semester.id)
    courseSemesters.set(course.id, id)
    courseSemesterNames.set(course.id, name)
    const group = semesterGroup(name, id)
    const existing = options.get(group.id)
    if (existing) {
      if (!existing.semesterIds.includes(id)) existing.semesterIds.push(id)
    } else options.set(group.id, { ...group, semesterIds: [id] })
  }
  const sorted = [...options.values()].sort(
    (a, b) =>
      (semesterOrder(b.name) ?? -1) - (semesterOrder(a.name) ?? -1) ||
      b.name.localeCompare(a.name, "zh-CN", { numeric: true })
  )
  const canChooseLatest =
    sorted.length > 0 && semesterOrder(sorted[0].name) !== null
  return {
    options: sorted,
    courseSemesters,
    courseSemesterNames,
    latestId: canChooseLatest ? sorted[0].id : "",
    warning:
      sorted.length && !canChooseLatest
        ? "无法确定最近学期，请手动选择。"
        : courses.length && !sorted.length
          ? "课程未提供学期信息，暂显示全部学期。"
          : ""
  }
}

// Use the same academic-year half for autumn/winter and spring/summer variants.
/**
 * Groups a semester into its academic half-year (autumn-winter or spring-summer).
 * @param name Semester name.
 * @param fallbackId Used as the group id when the name has no year.
 * @returns Group id and display name.
 */
export function semesterGroup(
  name: string,
  fallbackId: string
): { id: string; name: string } {
  const order = semesterOrder(name)
  if (order === null) return { id: "semester:" + fallbackId, name }
  const year = Math.floor(order / 4)
  const autumn = order % 4 >= 2
  const academicYear = autumn ? year : year - 1
  return {
    id: academicYear + ":" + (autumn ? "autumn" : "spring"),
    name: academicYear + "-" + (academicYear + 1) + (autumn ? "秋冬" : "春夏")
  }
}

/**
 * Filters courses by semester, status and keyword (matched against course and instructor names).
 * @param courses Courses to filter.
 * @param filters Selected semesters, statuses and keyword.
 * @param semesters Semester id of each course.
 * @param statuses Statuses of each course.
 * @returns Courses that match every filter.
 */
export function filterCourses<
  T extends {
    id: number
    name: string
    display_name: string
    instructors: { name: string }[]
  }
>(
  courses: T[],
  filters: CourseFilters,
  semesters: Map<number, string>,
  statuses: Map<number, Set<string>>
): T[] {
  const keyword = filters.keyword.trim().toLocaleLowerCase()
  return courses.filter(
    (course) =>
      (!filters.semester_id.length ||
        filters.semester_id.includes(semesters.get(course.id) || "")) &&
      (filters.status.length === COURSE_STATUSES.length ||
        filters.status.some((status) =>
          statuses.get(course.id)?.has(status)
        )) &&
      (!keyword ||
        [
          course.name,
          course.display_name,
          ...course.instructors.map((item) => item.name)
        ].some((text) => text?.toLocaleLowerCase().includes(keyword)))
  )
}
