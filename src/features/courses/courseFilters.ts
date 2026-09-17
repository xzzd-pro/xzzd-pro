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

export async function collectCourseSemesters(
  courses: { id: number }[], signal: AbortSignal
): Promise<{ options: SemesterOption[]; latestId: string; warning: string; courseSemesters: Map<number, string> }> {
  const options = new Map<string, SemesterOption>()
  const courseSemesters = new Map<number, string>()
  let cursor = 0
  let failed = false
  // The course-detail endpoint is already used by course overview. Limit concurrency
  // and only read each course once per page visit, never on filter/search changes.
  await Promise.all(Array.from({ length: Math.min(4, courses.length) }, async () => {
    while (cursor < courses.length && !signal.aborted) {
      const course = courses[cursor++]
      try {
        const response = await fetch(`/api/courses/${course.id}`, { credentials: "include", signal })
        if (!response.ok) throw new Error("Course details unavailable")
        const { semester } = await response.json()
        if (semester && (typeof semester.id === "number" || typeof semester.id === "string") && typeof semester.name === "string" && semester.name.trim()) {
          const id = String(semester.id)
          courseSemesters.set(course.id, id)
          const group = semesterGroup(semester.name.trim(), id)
          const existing = options.get(group.id)
          if (existing) {
            if (!existing.semesterIds.includes(id)) existing.semesterIds.push(id)
          } else options.set(group.id, { ...group, semesterIds: [id] })
        }
      } catch (error) {
        if (signal.aborted) throw error
        failed = true
      }
    }
  }))
  const sorted = [...options.values()].sort((a, b) =>
    (semesterOrder(b.name) ?? -1) - (semesterOrder(a.name) ?? -1) || b.name.localeCompare(a.name, "zh-CN", { numeric: true }))
  const canChooseLatest = !failed && sorted.length > 0 && semesterOrder(sorted[0].name) !== null
  return {
    options: sorted,
    courseSemesters,
    latestId: canChooseLatest ? sorted[0].id : "",
    warning: failed ? "部分学期信息加载失败，暂显示全部学期；可重试加载。" :
      sorted.length && !canChooseLatest ? "无法确定最近学期，请手动选择。" :
      courses.length && !sorted.length ? "课程未提供学期信息，暂显示全部学期。" : ""
  }
}

// Use the same academic-year half for autumn/winter and spring/summer variants.
export function semesterGroup(name: string, fallbackId: string): { id: string; name: string } {
  const order = semesterOrder(name)
  if (order === null) return { id: 'semester:' + fallbackId, name }
  const year = Math.floor(order / 4)
  const autumn = order % 4 >= 2
  const academicYear = autumn ? year : year - 1
  return { id: academicYear + ':' + (autumn ? 'autumn' : 'spring'), name: academicYear + '-' + (academicYear + 1) + (autumn ? '秋冬' : '春夏') }
}

export function filterCourses<T extends { id: number; name: string; display_name: string; instructors: { name: string }[] }>(
  courses: T[], filters: CourseFilters, semesters: Map<number, string>, statuses: Map<number, Set<string>>
): T[] {
  const keyword = filters.keyword.trim().toLocaleLowerCase()
  return courses.filter(course =>
    (!filters.semester_id.length || filters.semester_id.includes(semesters.get(course.id) || '')) &&
    (filters.status.length === COURSE_STATUSES.length || filters.status.some(status => statuses.get(course.id)?.has(status))) &&
    (!keyword || [course.name, course.display_name, ...course.instructors.map(item => item.name)].some(text => text?.toLocaleLowerCase().includes(keyword)))
  )
}
