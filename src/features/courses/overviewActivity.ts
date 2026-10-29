import { nativeActivityUrl } from "@/lib/nativePreview"
import { TODO_TYPE_NAMES, todoActivityUrl } from "@/shared/api/todos"
import type { ApiTodoData, CoursewareActivity } from "@/types"

const DAY_MS = 24 * 60 * 60 * 1000

export interface PendingItem {
  id: number
  title: string
  typeName: string
  link: string
  /** "10.30 23:59", or with the year when it differs from now; null without a deadline. */
  deadlineText: string | null
  /** Same rounding as the home todo list, so the two show the same badge. */
  daysLeft: number | null
}

export interface RecentUpload {
  id: number
  name: string
  activityTitle: string
  link: string
  time: Date | null
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad = (value: number) => String(value).padStart(2, "0")

// Infinity - Infinity is NaN, which would make Array.sort order unpredictable.
const compareNumbers = (a: number, b: number) => (a === b ? 0 : a - b)

function formatDeadline(date: Date, now: Date): string {
  const day = `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return date.getFullYear() === now.getFullYear()
    ? day
    : `${date.getFullYear()}.${day}`
}

/** This course's entries from the school's todo list, soonest deadline first. */
export function pendingForCourse(
  todos: ApiTodoData[],
  courseId: string | number,
  now = new Date()
): PendingItem[] {
  return todos
    .filter((item) => item && String(item.course_id) === String(courseId))
    .map((item) => {
      const deadline = parseDate(item.end_time)
      return {
        id: item.id,
        title: item.title || "未知任务",
        typeName: TODO_TYPE_NAMES[item.type] || item.type || "活动",
        link: todoActivityUrl(item),
        deadlineText: deadline ? formatDeadline(deadline, now) : null,
        daysLeft: deadline
          ? Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS)
          : null,
        deadlineTime: deadline?.getTime() ?? Number.POSITIVE_INFINITY
      }
    })
    .sort((a, b) => compareNumbers(a.deadlineTime, b.deadlineTime))
    .map(({ deadlineTime: _deadlineTime, ...item }) => item)
}

/**
 * Newest files across the course's courseware, newest first. A file without its
 * own timestamp uses its activity's creation (then update) time.
 */
export function recentUploads(
  activities: CoursewareActivity[],
  courseId: string | number,
  limit = 5
): RecentUpload[] {
  return activities
    .filter((activity) => activity && activity.is_started !== false)
    .flatMap((activity) =>
      (activity.uploads || []).map((upload) => ({
        id: upload.id,
        name: upload.name || "未命名文件",
        activityTitle: activity.title || "",
        link: nativeActivityUrl(courseId, activity.id),
        time:
          parseDate(upload.created_at) ??
          parseDate(activity.created_at) ??
          parseDate(activity.updated_at)
      }))
    )
    .sort((a, b) =>
      compareNumbers(
        b.time?.getTime() ?? -Infinity,
        a.time?.getTime() ?? -Infinity
      )
    )
    .slice(0, limit)
}

/** "今天" / "昨天" / "3 天前" within a week, otherwise the date. Counts calendar days. */
export function formatRelativeDay(date: Date, now = new Date()): string {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS)
  if (days <= 0) return "今天"
  if (days === 1) return "昨天"
  if (days < 7) return `${days} 天前`
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}
