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

/**
 * Builds the request body for the course list API.
 * @param conditions Filters to override; defaults list all statuses.
 * @returns Request body.
 */
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

/**
 * Requests the course list, moving to the next known endpoint when one returns 404 or fails to connect.
 * @param payload Request body from createMyCoursesPayload.
 * @returns The first response that is not a 404; the last endpoint's response is returned as is.
 * @throws The last network error if no endpoint responds.
 */
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

      if (
        response.status === 404 &&
        url !== MY_COURSES_URLS[MY_COURSES_URLS.length - 1]
      ) {
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
