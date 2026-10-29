import type { ReadTimestamps } from "@/types"

/** Filter tabs that can be marked read; "all" is a view, not a category. */
export const MARKABLE_FILTERS = [
  "activity_opened",
  "homework_opened_for_submission",
  "homework_score_updated",
  "exam_will_start",
  "others"
] as const

/** Types with their own read timestamp; everything else shares "others". */
const MAIN_TYPES = [
  "activity_opened",
  "homework_opened_for_submission",
  "course_homework_make_up",
  "homework_score_updated",
  "exam_opened",
  "exam_will_start",
  "exam_submit_started"
]

/** Notification types covered by one filter tab. */
export function typesForFilter(filter: string): string[] {
  if (filter === "exam_will_start") return ["exam_opened", "exam_will_start", "exam_submit_started"]
  if (filter === "homework_opened_for_submission") return ["homework_opened_for_submission", "course_homework_make_up"]
  return [filter]
}

/**
 * Read timestamps after marking the given filters read: each covered type (or
 * "others") moves up to its newest notification. Timestamps never move back.
 * Returns null when nothing changes. Computing every filter in one pass keeps
 * "mark all" from overwriting itself, which separate saves from the same
 * starting state would do.
 */
export function advanceReadTimestamps(
  current: ReadTimestamps,
  filters: readonly string[],
  notifications: ReadonlyArray<{ type: string; timestamp: number }>
): ReadTimestamps | null {
  const next: ReadTimestamps = { ...current }
  let updated = false
  const raise = (key: keyof ReadTimestamps, items: ReadonlyArray<{ timestamp: number }>) => {
    if (!items.length) return
    const newest = Math.max(...items.map((n) => n.timestamp))
    if (newest > next[key]) {
      next[key] = newest
      updated = true
    }
  }

  for (const filter of filters) {
    if (filter === "others") {
      raise("others", notifications.filter((n) => !MAIN_TYPES.includes(n.type)))
      continue
    }
    for (const type of typesForFilter(filter)) {
      if (!MAIN_TYPES.includes(type)) continue
      raise(type as keyof ReadTimestamps, notifications.filter((n) => n.type === type))
    }
  }
  return updated ? next : null
}

/** Whether a notification counts as read under the given timestamps (same rule as loading). */
export function isReadAt(timestamps: ReadTimestamps, notification: { type: string; timestamp: number }): boolean {
  const key = (MAIN_TYPES.includes(notification.type) ? notification.type : "others") as keyof ReadTimestamps
  return notification.timestamp <= (timestamps[key] || 0)
}

/** "Mark all read" can be undone for a day; later, restoring would revive long-settled items. */
export const READ_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000

export interface ReadUndo {
  timestamps: ReadTimestamps
  savedAt: number
}

export function isUsableUndo(value: unknown, now = Date.now()): value is ReadUndo {
  if (!value || typeof value !== "object") return false
  const { timestamps, savedAt } = value as Partial<ReadUndo>
  return typeof savedAt === "number" &&
    now - savedAt >= 0 && now - savedAt < READ_UNDO_WINDOW_MS &&
    !!timestamps && typeof timestamps === "object"
}
