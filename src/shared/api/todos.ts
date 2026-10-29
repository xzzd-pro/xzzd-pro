import type { ApiTodoData } from "@/types"

/** Display names for the activity types the school's todo list returns. */
export const TODO_TYPE_NAMES: Record<string, string> = {
  homework: "作业",
  exam: "考试",
  evaluation: "评教",
  questionnaire: "问卷",
  vote: "投票"
}

/**
 * Builds the link to a to-do's activity page; exams use their own path.
 * @param item To-do from the API.
 * @returns The activity URL, or "#" if the to-do lacks ids.
 */
export function todoActivityUrl(item: ApiTodoData): string {
  if (!item.course_id || !item.id) {
    return "#"
  }
  // Exam type uses different URL format
  if (item.type === "exam") {
    return `https://courses.zju.edu.cn/course/${item.course_id}/learning-activity#/exam/${item.id}`
  }
  return `https://courses.zju.edu.cn/course/${item.course_id}/learning-activity#/${item.id}`
}

/** The signed-in user's unfinished activities across all courses; null when the request fails. */
export async function fetchTodos(): Promise<ApiTodoData[] | null> {
  try {
    const response = await fetch("/api/todos?no-intercept=true")

    if (!response.ok) {
      console.error("XZZDPRO: API 请求失败", response.status)
      return null
    }

    const data = await response.json()

    if (data.todo_list && Array.isArray(data.todo_list)) {
      return data.todo_list
    }

    if (Array.isArray(data)) return data

    console.warn("XZZDPRO: 未找到预期的数据结构", data)
    return null
  } catch (error) {
    console.error("XZZDPRO: 网络请求出错", error)
    return null
  }
}
