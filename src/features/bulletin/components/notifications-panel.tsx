import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { storage } from "@/lib/storage"
import { describeLoadError, LoadError } from "@/shared/api/load-error"
import {
  createMyCoursesPayload,
  fetchMyCoursesResponse
} from "@/shared/api/my-courses-api"
import type {
  ApiNotificationData,
  NotificationType,
  ProcessedNotification,
  ReadTimestamps
} from "@/types"

import { findNotificationUser } from "../find-notification-user"
import {
  advanceReadTimestamps,
  isReadAt,
  isUsableUndo,
  typesForFilter,
  type ReadUndo
} from "../read-state"
import {
  clampSplitRatio,
  ratioFromPointer,
  SPLIT_DEFAULT,
  SPLIT_KEYBOARD_STEP,
  SPLIT_MAX,
  SPLIT_MIN,
  SPLIT_STORAGE_KEY,
  splitColumns
} from "../split-ratio"
import { NotificationCard } from "./notification-card"

const READ_TIMESTAMPS_KEY = "xzzdpro_read_timestamps"
// Read state from just before the last "mark all read", kept so it can be undone.
const READ_UNDO_KEY = "xzzdpro_read_timestamps_undo"

const VALID_TYPES = [
  "activity_opened",
  "homework_opened_for_submission",
  "course_homework_make_up",
  "homework_score_updated",
  "exam_opened",
  "exam_will_start",
  "exam_submit_started",
  "activity_expiring",
  "course_opened",
  "course_closed",
  "course_updated",
  "announcement_published",
  "forum_topic_created",
  "forum_reply_created",
  "rollcall_started",
  "rollcall_ended",
  "grade_published",
  "certificate_issued"
]

const DEFAULT_READ_TIMESTAMPS: ReadTimestamps = {
  activity_opened: 0,
  homework_opened_for_submission: 0,
  course_homework_make_up: 0,
  homework_score_updated: 0,
  exam_opened: 0,
  exam_will_start: 0,
  exam_submit_started: 0,
  others: 0
}

async function loadReadTimestamps(): Promise<ReadTimestamps> {
  try {
    const stored = await storage.get<ReadTimestamps>(READ_TIMESTAMPS_KEY)
    if (stored) {
      return { ...DEFAULT_READ_TIMESTAMPS, ...stored }
    }
  } catch (error) {
    console.error("XZZDPRO: 加载已读时间戳失败", error)
  }
  return { ...DEFAULT_READ_TIMESTAMPS }
}

async function saveReadTimestamps(timestamps: ReadTimestamps): Promise<void> {
  try {
    await storage.set(READ_TIMESTAMPS_KEY, timestamps)
    console.log("XZZDPRO: 已保存已读时间戳", timestamps)
  } catch (error) {
    console.error("XZZDPRO: 保存已读时间戳失败", error)
  }
}

/**
 * Finds the current user's id, which the notification API needs.
 * @param signal Cancels the lookup.
 * @returns The user id, or null if the lookup was cancelled.
 * @throws LoadError if the course list cannot be loaded or no course reveals the id.
 */
async function getUserId(signal?: AbortSignal): Promise<string | null> {
  const coursesResponse = await fetchMyCoursesResponse(createMyCoursesPayload())
  if (!coursesResponse.ok) {
    throw new LoadError("课程列表请求失败", coursesResponse.status)
  }
  const coursesData = await coursesResponse.json()
  if (!coursesData.courses || coursesData.courses.length === 0) {
    throw new LoadError("没有找到任何课程，无法确定当前用户。")
  }
  const userId = await findNotificationUser(coursesData.courses, signal)
  if (!userId && !signal?.aborted) {
    throw new LoadError("无法确定当前用户，请确认已登录学在浙大。")
  }
  return userId
}

/**
 * Fetches a page of the user's notifications.
 * @param userId Current user id.
 * @param offset Number of notifications to skip.
 * @param limit Maximum number to return.
 * @param signal Cancels the request.
 * @returns The notifications; empty if the response has none.
 * @throws LoadError on an HTTP error, or the fetch error if the request fails.
 */
async function fetchNotifications(
  userId: string,
  offset = 0,
  limit = 100,
  signal?: AbortSignal
): Promise<ApiNotificationData[]> {
  const url = `https://courses.zju.edu.cn/ntf/users/${userId}/notifications?offset=${offset}&limit=${limit}&removed=only_mobile&additionalFields=total_count`
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new LoadError("公告请求失败", response.status)
  }
  const data = await response.json()
  return Array.isArray(data.notifications) ? data.notifications : []
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      return `${minutes}分钟前`
    }
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}.${month}.${day}`
  }
}

function generateNotificationLink(notification: ApiNotificationData): string {
  const { payload } = notification

  if (payload.exam_id && payload.course_id) {
    return `https://courses.zju.edu.cn/course/${payload.course_id}/learning-activity#/exam/${payload.exam_id}`
  } else if (payload.homework_id && payload.course_id) {
    return `https://courses.zju.edu.cn/course/${payload.course_id}/learning-activity#/${payload.homework_id}`
  } else if (payload.activity_id && payload.course_id) {
    return `https://courses.zju.edu.cn/course/${payload.course_id}/learning-activity#/${payload.activity_id}`
  } else if (payload.course_id) {
    return `https://courses.zju.edu.cn/course/${payload.course_id}`
  }

  return "#"
}

/**
 * Converts an API notification into a display item and works out whether it is read, using the read timestamp of its type.
 * @param notification Notification from the API.
 * @param readTimestamps Time each type was last marked read.
 * @returns The display item, or null for unsupported types.
 */
function processNotification(
  notification: ApiNotificationData,
  readTimestamps: ReadTimestamps
): ProcessedNotification | null {
  if (!VALID_TYPES.includes(notification.type)) {
    return null
  }

  const { payload } = notification
  let title = ""

  if (payload.activity_title) {
    title = payload.activity_title
  } else if (payload.homework_title) {
    title = payload.homework_title
  } else if (payload.exam_title) {
    title = payload.exam_title
  } else {
    title = "未知通知"
  }

  // Types tracked separately; every other type shares the "others" read timestamp.
  const mainTypes = [
    "activity_opened",
    "homework_opened_for_submission",
    "course_homework_make_up",
    "homework_score_updated",
    "exam_opened",
    "exam_will_start",
    "exam_submit_started"
  ]

  let typeKey: keyof ReadTimestamps
  if (mainTypes.includes(notification.type)) {
    typeKey = notification.type as keyof ReadTimestamps
  } else {
    typeKey = "others"
  }

  const storedTimestamp = readTimestamps[typeKey] || 0
  const isRead = notification.timestamp <= storedTimestamp

  return {
    id: notification.id,
    type: notification.type as NotificationType,
    title,
    courseName: payload.course_name,
    time: formatTime(notification.timestamp),
    link: generateNotificationLink(notification),
    read: isRead,
    score: payload.score,
    timestamp: notification.timestamp
  }
}

/**
 * Loads notifications and shows them split into unread and read columns with a draggable divider.
 */
export function NotificationsPanel() {
  const [allNotifications, setAllNotifications] = useState<
    ProcessedNotification[]
  >([])
  const [readTimestamps, setReadTimestamps] = useState<ReadTimestamps>(
    DEFAULT_READ_TIMESTAMPS
  )
  const [unreadFilter, setUnreadFilter] = useState("all")
  const [readFilter, setReadFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  // Types marked read in this visit: their badges clear, but they stay in the unread column until reload.
  const [tempReadTypes, setTempReadTypes] = useState<Set<string>>(new Set())
  // State before the last "mark as read", restorable for 24 hours.
  const [readUndo, setReadUndo] = useState<ReadUndo | null>(null)

  useEffect(() => {
    let cancelled = false
    storage
      .get<unknown>(READ_UNDO_KEY)
      .then((saved) => {
        if (cancelled || saved === undefined) return
        if (isUsableUndo(saved)) setReadUndo(saved)
        else void storage.remove(READ_UNDO_KEY)
      })
      .catch((error) => console.warn("XZZDPRO: 读取撤销记录失败", error))
    return () => {
      cancelled = true
    }
  }, [])
  // Share of the width given to the unread column; adjustable by dragging the divider (two-column layout only).
  const [splitRatio, setSplitRatioState] = useState(SPLIT_DEFAULT)
  // Mirrors the state so fast key repeats read the latest value, not the last render's.
  const splitRatioRef = useRef(SPLIT_DEFAULT)
  const setSplitRatio = useCallback((ratio: number) => {
    splitRatioRef.current = ratio
    setSplitRatioState(ratio)
  }, [])
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    storage
      .get<number>(SPLIT_STORAGE_KEY)
      .then((saved) => {
        if (!cancelled && saved !== undefined)
          setSplitRatio(clampSplitRatio(saved))
      })
      .catch((error) => console.warn("XZZDPRO: 读取公告栏宽度失败", error))
    return () => {
      cancelled = true
    }
  }, [])

  const saveSplitRatio = useCallback((ratio: number) => {
    storage
      .set(SPLIT_STORAGE_KEY, ratio)
      .catch((error) => console.warn("XZZDPRO: 保存公告栏宽度失败", error))
  }, [])

  const handleSplitPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      draggingRef.current = true
    },
    []
  )

  const handleSplitPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !splitContainerRef.current) return
      setSplitRatio(
        ratioFromPointer(
          event.clientX,
          splitContainerRef.current.getBoundingClientRect()
        )
      )
    },
    []
  )

  const handleSplitPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      event.currentTarget.releasePointerCapture(event.pointerId)
      if (splitContainerRef.current) {
        const ratio = ratioFromPointer(
          event.clientX,
          splitContainerRef.current.getBoundingClientRect()
        )
        setSplitRatio(ratio)
        saveSplitRatio(ratio)
      }
    },
    [saveSplitRatio]
  )

  const handleSplitKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step =
        event.key === "ArrowLeft"
          ? -SPLIT_KEYBOARD_STEP
          : event.key === "ArrowRight"
            ? SPLIT_KEYBOARD_STEP
            : 0
      if (!step) return
      event.preventDefault()
      const next = clampSplitRatio(splitRatioRef.current + step)
      setSplitRatio(next)
      saveSplitRatio(next)
    },
    [setSplitRatio, saveSplitRatio]
  )

  const resetSplitRatio = useCallback(() => {
    setSplitRatio(SPLIT_DEFAULT)
    saveSplitRatio(SPLIT_DEFAULT)
  }, [saveSplitRatio])

  const [loadError, setLoadError] = useState<string | null>(null)
  // Bumped by the retry button to run the load effect again.
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function loadData() {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [timestamps, rawNotifications] = await Promise.all([
          loadReadTimestamps(),
          getUserId(controller.signal).then((id) =>
            id && !controller.signal.aborted
              ? fetchNotifications(id, 0, 100, controller.signal)
              : []
          )
        ])
        if (controller.signal.aborted) return
        setReadTimestamps(timestamps)
        setAllNotifications(
          rawNotifications
            .map((n) => processNotification(n, timestamps))
            .filter((n): n is ProcessedNotification => n !== null)
        )
      } catch (error) {
        if (controller.signal.aborted) return
        console.warn("XZZDPRO: 获取公告异常", error)
        setAllNotifications([])
        setLoadError(describeLoadError(error, "公告"))
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    void loadData()
    return () => controller.abort()
  }, [loadAttempt])

  const retryLoad = useCallback(() => setLoadAttempt((value) => value + 1), [])

  // Marks filter categories as read: badges clear now, items move to the read column after reload.
  const markFiltersAsRead = useCallback(
    async (filters: readonly string[]) => {
      setTempReadTypes((prev) => {
        const newSet = new Set(prev)
        filters.forEach((filter) =>
          typesForFilter(filter).forEach((t) => newSet.add(t))
        )
        return newSet
      })

      // Compute every category's timestamp first and save once, so consecutive saves don't overwrite each other.
      const newTimestamps = advanceReadTimestamps(
        readTimestamps,
        filters,
        allNotifications
      )
      if (newTimestamps) {
        await saveReadTimestamps(newTimestamps)
        setReadTimestamps(newTimestamps)
        console.log("XZZDPRO: 已标记为临时已读，刷新后将移动到已读栏", filters)
      }
    },
    [readTimestamps, allNotifications]
  )

  // Snapshot the current state before marking, so it can be undone within 24 hours.
  const handleMarkRead = useCallback(
    async (filters: readonly string[]) => {
      const snapshot: ReadUndo = {
        timestamps: readTimestamps,
        savedAt: Date.now()
      }
      try {
        await storage.set(READ_UNDO_KEY, snapshot)
        setReadUndo(snapshot)
      } catch (error) {
        console.warn("XZZDPRO: 保存撤销记录失败", error)
      }
      await markFiltersAsRead(filters)
    },
    [readTimestamps, markFiltersAsRead]
  )

  // Restore the state before the last "mark as read": timestamps, badges and columns revert at once.
  const handleUndoMarkRead = useCallback(async () => {
    if (!readUndo) return
    const restored: ReadTimestamps = {
      ...DEFAULT_READ_TIMESTAMPS,
      ...readUndo.timestamps
    }
    await saveReadTimestamps(restored)
    setReadTimestamps(restored)
    setTempReadTypes(new Set())
    setAllNotifications((prev) =>
      prev.map((n) => ({ ...n, read: isReadAt(restored, n) }))
    )
    setReadUndo(null)
    await storage
      .remove(READ_UNDO_KEY)
      .catch((error) => console.warn("XZZDPRO: 清除撤销记录失败", error))
  }, [readUndo])

  const unreadNotifications = allNotifications.filter((n) => !n.read)
  const readNotifications = allNotifications.filter((n) => n.read)

  return (
    <div
      ref={splitContainerRef}
      className="grid grid-cols-1 gap-6 h-full min-h-0 lg:gap-0 lg:[grid-template-columns:var(--bulletin-split)]"
      style={
        { "--bulletin-split": splitColumns(splitRatio) } as React.CSSProperties
      }>
      <NotificationCard
        title="未读公告"
        notifications={unreadNotifications}
        filter={unreadFilter}
        onFilterChange={setUnreadFilter}
        showBadges={true}
        onMarkRead={handleMarkRead}
        onUndoMarkRead={readUndo ? handleUndoMarkRead : undefined}
        isLoading={isLoading}
        error={loadError}
        onRetry={retryLoad}
        tempReadTypes={tempReadTypes}
      />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="调整未读与已读公告的宽度"
        aria-valuemin={Math.round(SPLIT_MIN * 100)}
        aria-valuemax={Math.round(SPLIT_MAX * 100)}
        aria-valuenow={Math.round(splitRatio * 100)}
        title="拖动调整宽度，双击恢复"
        tabIndex={0}
        className="group hidden lg:flex justify-center cursor-ew-resize touch-none select-none outline-none"
        onPointerDown={handleSplitPointerDown}
        onPointerMove={handleSplitPointerMove}
        onPointerUp={handleSplitPointerUp}
        onPointerCancel={handleSplitPointerUp}
        onKeyDown={handleSplitKeyDown}
        onDoubleClick={resetSplitRatio}>
        <div className="w-0.5 h-full rounded-full bg-transparent transition-colors group-hover:bg-primary/40 group-focus-visible:bg-primary group-active:bg-primary" />
      </div>
      <NotificationCard
        title="已读公告"
        notifications={readNotifications}
        filter={readFilter}
        onFilterChange={setReadFilter}
        showBadges={false}
        isLoading={isLoading}
        error={loadError}
      />
    </div>
  )
}
