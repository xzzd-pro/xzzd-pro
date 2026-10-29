import { findNotificationUser } from "../findNotificationUser"
import * as React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { storage } from "@/lib/storage"
import { NotificationCard } from "./NotificationCard"
import {
  SPLIT_DEFAULT,
  SPLIT_KEYBOARD_STEP,
  SPLIT_MAX,
  SPLIT_MIN,
  SPLIT_STORAGE_KEY,
  clampSplitRatio,
  ratioFromPointer,
  splitColumns
} from "../splitRatio"
import { createMyCoursesPayload, fetchMyCoursesResponse } from "@/shared/api/myCoursesApi"
import type { ApiNotificationData, ProcessedNotification, ReadTimestamps, NotificationType } from "@/types"

const READ_TIMESTAMPS_KEY = 'xzzdpro_read_timestamps'

const VALID_TYPES = [
  'activity_opened',
  'homework_opened_for_submission',
  'course_homework_make_up',
  'homework_score_updated',
  'exam_opened',
  'exam_will_start',
  'exam_submit_started',
  'activity_expiring',
  'course_opened',
  'course_closed',
  'course_updated',
  'announcement_published',
  'forum_topic_created',
  'forum_reply_created',
  'rollcall_started',
  'rollcall_ended',
  'grade_published',
  'certificate_issued'
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
    console.error('XZZDPRO: 加载已读时间戳失败', error)
  }
  return { ...DEFAULT_READ_TIMESTAMPS }
}

async function saveReadTimestamps(timestamps: ReadTimestamps): Promise<void> {
  try {
    await storage.set(READ_TIMESTAMPS_KEY, timestamps)
    console.log('XZZDPRO: 已保存已读时间戳', timestamps)
  } catch (error) {
    console.error('XZZDPRO: 保存已读时间戳失败', error)
  }
}

async function getUserId(signal?: AbortSignal): Promise<string | null> {
  try {
    const coursesResponse = await fetchMyCoursesResponse(
      createMyCoursesPayload()
    )

    if (!coursesResponse.ok) {
      console.error('XZZDPRO: 获取课程列表失败', coursesResponse.status)
      return null
    }

    const coursesData = await coursesResponse.json()
    if (!coursesData.courses || coursesData.courses.length === 0) {
      console.error('XZZDPRO: 没有找到任何课程')
      return null
    }

    return findNotificationUser(coursesData.courses, signal)
  } catch (error) {
    console.error('XZZDPRO: 获取用户ID时出错', error)
    return null
  }
}

async function fetchNotifications(userId: string, offset = 0, limit = 100, signal?: AbortSignal): Promise<ApiNotificationData[]> {
  try {
    const url = `https://courses.zju.edu.cn/ntf/users/${userId}/notifications?offset=${offset}&limit=${limit}&removed=only_mobile&additionalFields=total_count`
    const response = await fetch(url, { signal })

    if (!response.ok) {
      console.error('XZZDPRO: 公告API请求失败', response.status)
      return []
    }

    const data = await response.json()
    if (data.notifications && Array.isArray(data.notifications)) {
      return data.notifications
    }

    return []
  } catch (error) {
    console.error('XZZDPRO: 公告网络请求出错', error)
    return []
  }
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
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
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

  return '#'
}

function processNotification(
  notification: ApiNotificationData,
  readTimestamps: ReadTimestamps
): ProcessedNotification | null {
  if (!VALID_TYPES.includes(notification.type)) {
    return null
  }

  const { payload } = notification
  let title = ''

  if (payload.activity_title) {
    title = payload.activity_title
  } else if (payload.homework_title) {
    title = payload.homework_title
  } else if (payload.exam_title) {
    title = payload.exam_title
  } else {
    title = '未知通知'
  }

  // 判断是否属于主要分类
  const mainTypes = [
    'activity_opened',
    'homework_opened_for_submission',
    'course_homework_make_up',
    'homework_score_updated',
    'exam_opened',
    'exam_will_start',
    'exam_submit_started'
  ]

  let typeKey: keyof ReadTimestamps
  if (mainTypes.includes(notification.type)) {
    typeKey = notification.type as keyof ReadTimestamps
  } else {
    typeKey = 'others'
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

export function NotificationsPanel() {
  const [allNotifications, setAllNotifications] = useState<ProcessedNotification[]>([])
  const [readTimestamps, setReadTimestamps] = useState<ReadTimestamps>(DEFAULT_READ_TIMESTAMPS)
  const [unreadFilter, setUnreadFilter] = useState('all')
  const [readFilter, setReadFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  // 临时已读的通知类型，用于去掉红点但保持在未读栏中
  const [tempReadTypes, setTempReadTypes] = useState<Set<string>>(new Set())
  // 未读栏占两栏总宽的比例，可拖动中间分隔条调整（仅宽屏双栏时生效）
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
    storage.get<number>(SPLIT_STORAGE_KEY)
      .then((saved) => {
        if (!cancelled && saved !== undefined) setSplitRatio(clampSplitRatio(saved))
      })
      .catch((error) => console.warn('XZZDPRO: 读取公告栏宽度失败', error))
    return () => { cancelled = true }
  }, [])

  const saveSplitRatio = useCallback((ratio: number) => {
    storage.set(SPLIT_STORAGE_KEY, ratio)
      .catch((error) => console.warn('XZZDPRO: 保存公告栏宽度失败', error))
  }, [])

  const handleSplitPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
  }, [])

  const handleSplitPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !splitContainerRef.current) return
    setSplitRatio(ratioFromPointer(event.clientX, splitContainerRef.current.getBoundingClientRect()))
  }, [])

  const handleSplitPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (splitContainerRef.current) {
      const ratio = ratioFromPointer(event.clientX, splitContainerRef.current.getBoundingClientRect())
      setSplitRatio(ratio)
      saveSplitRatio(ratio)
    }
  }, [saveSplitRatio])

  const handleSplitKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowLeft' ? -SPLIT_KEYBOARD_STEP : event.key === 'ArrowRight' ? SPLIT_KEYBOARD_STEP : 0
    if (!step) return
    event.preventDefault()
    const next = clampSplitRatio(splitRatioRef.current + step)
    setSplitRatio(next)
    saveSplitRatio(next)
  }, [setSplitRatio, saveSplitRatio])

  const resetSplitRatio = useCallback(() => {
    setSplitRatio(SPLIT_DEFAULT)
    saveSplitRatio(SPLIT_DEFAULT)
  }, [saveSplitRatio])

  useEffect(() => {
    const controller = new AbortController()
    async function loadData() {
      setIsLoading(true)
      try {
        const [timestamps, rawNotifications] = await Promise.all([
          loadReadTimestamps(),
          getUserId(controller.signal).then(id => id && !controller.signal.aborted ? fetchNotifications(id, 0, 100, controller.signal) : [])
        ])
        if (controller.signal.aborted) return
        setReadTimestamps(timestamps)
        setAllNotifications(rawNotifications.map(n => processNotification(n, timestamps)).filter((n): n is ProcessedNotification => n !== null))
      } catch (error) {
        if (!controller.signal.aborted) console.warn('XZZDPRO: 获取公告异常', error)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    void loadData()
    return () => controller.abort()
  }, [])

  const handleMarkAsRead = useCallback(async (type: string) => {
    let typesToMark: string[]
    if (type === 'exam_will_start') {
      typesToMark = ['exam_opened', 'exam_will_start', 'exam_submit_started']
    } else if (type === 'homework_opened_for_submission') {
      typesToMark = ['homework_opened_for_submission', 'course_homework_make_up']
    } else if (type === 'others') {
      typesToMark = ['others']
    } else {
      typesToMark = [type]
    }

    // 将这些类型添加到临时已读集合中
    setTempReadTypes(prev => {
      const newSet = new Set(prev)
      typesToMark.forEach(t => newSet.add(t))
      return newSet
    })

    // 保存时间戳到存储，但不立即更新通知的 read 状态
    let updated = false
    const newTimestamps = { ...readTimestamps }

    if (type === 'others') {
      // 标记所有其他类型的通知为已读
      const mainTypes = [
        'activity_opened',
        'homework_opened_for_submission',
        'course_homework_make_up',
        'homework_score_updated',
        'exam_opened',
        'exam_will_start',
        'exam_submit_started'
      ]
      const otherNotifications = allNotifications.filter(n => !mainTypes.includes(n.type))
      if (otherNotifications.length > 0) {
        const maxTimestamp = Math.max(...otherNotifications.map(n => n.timestamp))
        newTimestamps.others = maxTimestamp
        updated = true
      }
    } else {
      for (const t of typesToMark) {
        const notificationsOfType = allNotifications.filter(n => n.type === t)
        if (notificationsOfType.length === 0) continue

        const maxTimestamp = Math.max(...notificationsOfType.map(n => n.timestamp))
        const typeKey = t as keyof ReadTimestamps

        if (maxTimestamp > newTimestamps[typeKey]) {
          newTimestamps[typeKey] = maxTimestamp
          updated = true
        }
      }
    }

    if (updated) {
      await saveReadTimestamps(newTimestamps)
      setReadTimestamps(newTimestamps)
      console.log('XZZDPRO: 已标记为临时已读，刷新后将移动到已读栏', typesToMark)
    }
  }, [readTimestamps, allNotifications])

  const unreadNotifications = allNotifications.filter(n => !n.read)
  const readNotifications = allNotifications.filter(n => n.read)

  return (
    <div
      ref={splitContainerRef}
      className="grid grid-cols-1 gap-6 h-full min-h-0 lg:gap-0 lg:[grid-template-columns:var(--bulletin-split)]"
      style={{ "--bulletin-split": splitColumns(splitRatio) } as React.CSSProperties}
    >
      <NotificationCard
        title="未读公告"
        notifications={unreadNotifications}
        filter={unreadFilter}
        onFilterChange={setUnreadFilter}
        showBadges={true}
        onMarkAsRead={handleMarkAsRead}
        isLoading={isLoading}
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
        onDoubleClick={resetSplitRatio}
      >
        <div className="w-0.5 h-full rounded-full bg-transparent transition-colors group-hover:bg-primary/40 group-focus-visible:bg-primary group-active:bg-primary" />
      </div>
      <NotificationCard
        title="已读公告"
        notifications={readNotifications}
        filter={readFilter}
        onFilterChange={setReadFilter}
        showBadges={false}
        isLoading={isLoading}
      />
    </div>
  )
}
