import * as React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FilterTabs } from "./FilterTabs"
import { NotificationItem } from "./NotificationItem"
import type { ProcessedNotification } from "../../types"

export interface NotificationCardProps {
  title: string
  notifications: ProcessedNotification[]
  filter: string
  onFilterChange: (filter: string) => void
  showBadges?: boolean
  onMarkAsRead?: (type: string) => void
  isLoading?: boolean
}

function filterNotifications(
  notifications: ProcessedNotification[],
  filterType: string
): ProcessedNotification[] {
  if (filterType === 'all') return notifications

  if (filterType === 'exam_will_start') {
    return notifications.filter(n =>
      n.type === 'exam_opened' ||
      n.type === 'exam_will_start' ||
      n.type === 'exam_submit_started'
    )
  }

  if (filterType === 'homework_opened_for_submission') {
    return notifications.filter(n =>
      n.type === 'homework_opened_for_submission' ||
      n.type === 'course_homework_make_up'
    )
  }

  if (filterType === 'others') {
    const mainTypes = [
      'activity_opened',
      'homework_opened_for_submission',
      'course_homework_make_up',
      'homework_score_updated',
      'exam_opened',
      'exam_will_start',
      'exam_submit_started'
    ]
    return notifications.filter(n => !mainTypes.includes(n.type))
  }

  return notifications.filter(n => n.type === filterType)
}

function calculateCounts(notifications: ProcessedNotification[]): Record<string, number> {
  const mainTypes = [
    'activity_opened',
    'homework_opened_for_submission',
    'course_homework_make_up',
    'homework_score_updated',
    'exam_opened',
    'exam_will_start',
    'exam_submit_started'
  ]

  return {
    all: notifications.length,
    activity_opened: notifications.filter(n => n.type === 'activity_opened').length,
    homework_opened_for_submission: notifications.filter(n =>
      n.type === 'homework_opened_for_submission' || n.type === 'course_homework_make_up'
    ).length,
    homework_score_updated: notifications.filter(n => n.type === 'homework_score_updated').length,
    exam_will_start: notifications.filter(n =>
      n.type === 'exam_opened' || n.type === 'exam_will_start' || n.type === 'exam_submit_started'
    ).length,
    others: notifications.filter(n => !mainTypes.includes(n.type)).length,
  }
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="p-3 pb-1">
            <div className="flex justify-between items-center gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-5 w-3/4" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-12" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function NotificationCard({
  title,
  notifications,
  filter,
  onFilterChange,
  showBadges = false,
  onMarkAsRead,
  isLoading = false
}: NotificationCardProps) {
  const filteredNotifications = filterNotifications(notifications, filter)
  const counts = calculateCounts(notifications)

  return (
    <Card className="flex flex-col min-h-0 overflow-hidden">
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="text-3xl font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
        <div className="flex-shrink-0">
          <FilterTabs
            activeFilter={filter}
            onFilterChange={onFilterChange}
            counts={counts}
            showBadges={showBadges}
            onMarkAsRead={onMarkAsRead}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="pr-2">
            {isLoading ? (
              <LoadingSkeleton />
            ) : filteredNotifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-lg">
                暂无公告
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
