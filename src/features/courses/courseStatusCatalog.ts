import { createMyCoursesPayload, fetchMyCoursesResponse } from "@/shared/api/myCoursesApi"
import { COURSE_STATUSES } from "./courseFilters"

// Resolve status using the existing server-side status semantics, once per visit.
export async function collectCourseStatuses(): Promise<Map<number, Set<string>>> {
  const result = new Map<number, Set<string>>()
  await Promise.all(COURSE_STATUSES.map(async status => {
    const response = await fetchMyCoursesResponse(createMyCoursesPayload({ status: [status] }))
    if (!response.ok) throw new Error("课程状态加载失败")
    const data = await response.json()
    if (!Array.isArray(data.courses)) throw new Error("课程状态数据无效")
    for (const course of data.courses) {
      const statuses = result.get(course.id) || new Set<string>()
      statuses.add(status)
      result.set(course.id, statuses)
    }
  }))
  return result
}
