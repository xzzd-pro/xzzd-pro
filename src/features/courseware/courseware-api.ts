import type { CoursewareActivity, CoursewareApiResponse } from "@/types"

function buildCoursewareListUrl(courseId: string): string {
  const conditions = encodeURIComponent(
    JSON.stringify({
      category: null,
      itemsSortBy: {
        predicate: "chapter",
        reverse: false
      },
      ignore_activity_types: ["lesson"]
    })
  )

  return `https://courses.zju.edu.cn/api/course/${courseId}/coursewares?conditions=${conditions}&page=1&page_size=1000`
}

/** All courseware activities of a course; null when the request fails. */
export async function fetchCoursewares(
  courseId: string
): Promise<CoursewareActivity[] | null> {
  try {
    const response = await fetch(buildCoursewareListUrl(courseId), {
      credentials: "include"
    })

    if (!response.ok) {
      console.error("XZZDPRO: failed to fetch coursewares", response.status)
      return null
    }

    const data: CoursewareApiResponse = await response.json()
    return data.activities || []
  } catch (error) {
    console.error("XZZDPRO: failed to fetch coursewares", error)
    return null
  }
}
