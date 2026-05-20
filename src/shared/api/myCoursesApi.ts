type SemesterId = string | number

export interface MyCoursesConditions {
  semester_id?: SemesterId[]
  status?: string[]
  keyword?: string
  classify_type?: string
  display_studio_list?: boolean
}

export interface MyCoursesPayload {
  conditions: {
    semester_id: SemesterId[]
    status: string[]
    keyword: string
    classify_type: string
    display_studio_list: boolean
  }
  showScorePassedStatus: boolean
}

const MY_COURSES_URLS = [
  "/api/my-courses?no-intercept=true",
  "/api/my-courses",
  "https://courses.zju.edu.cn/api/my-courses"
] as const

export function createMyCoursesPayload(
  conditions: MyCoursesConditions = {}
): MyCoursesPayload {
  return {
    conditions: {
      semester_id: conditions.semester_id ?? [],
      status: conditions.status ?? ["ongoing", "notStarted", "closed"],
      keyword: conditions.keyword ?? "",
      classify_type: conditions.classify_type ?? "recently_started",
      display_studio_list: conditions.display_studio_list ?? false
    },
    showScorePassedStatus: false
  }
}

export async function fetchMyCoursesResponse(
  payload: MyCoursesPayload
): Promise<Response> {
  let lastError: unknown

  for (const url of MY_COURSES_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(payload)
      })

      if (response.status === 404 && url !== MY_COURSES_URLS[MY_COURSES_URLS.length - 1]) {
        continue
      }

      return response
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to fetch my-courses")
}
