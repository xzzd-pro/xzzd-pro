import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProcessedNotification } from "@/types"

import { MARKABLE_FILTERS } from "../read-state"
import { FILTER_OPTIONS, FilterTabs, isFilterMarked } from "./filter-tabs"
import { NotificationItem } from "./notification-item"

export interface NotificationCardProps {
  title: string
  notifications: ProcessedNotification[]
  filter: string
  onFilterChange: (filter: string) => void
  showBadges?: boolean
  /** Marks the given filter categories read; shown only on the unread card. */
  onMarkRead?: (filters: readonly string[]) => void
  /** Present while the last "mark read" can still be undone. */
  onUndoMarkRead?: () => void
  isLoading?: boolean
  /** Message shown instead of the list when loading failed. */
  error?: string | null
  /** Reloads the notifications after a failure. */
  onRetry?: () => void
  tempReadTypes?: Set<string>
}

function filterNotifications(
  notifications: ProcessedNotification[],
  filterType: string
): ProcessedNotification[] {
  if (filterType === "all") return notifications

  if (filterType === "exam_will_start") {
    return notifications.filter(
      (n) =>
        n.type === "exam_opened" ||
        n.type === "exam_will_start" ||
        n.type === "exam_submit_started"
    )
  }

  if (filterType === "homework_opened_for_submission") {
    return notifications.filter(
      (n) =>
        n.type === "homework_opened_for_submission" ||
        n.type === "course_homework_make_up"
    )
  }

  if (filterType === "others") {
    const mainTypes = [
      "activity_opened",
      "homework_opened_for_submission",
      "course_homework_make_up",
      "homework_score_updated",
      "exam_opened",
      "exam_will_start",
      "exam_submit_started"
    ]
    return notifications.filter((n) => !mainTypes.includes(n.type))
  }

  return notifications.filter((n) => n.type === filterType)
}

function calculateCounts(
  notifications: ProcessedNotification[]
): Record<string, number> {
  const mainTypes = [
    "activity_opened",
    "homework_opened_for_submission",
    "course_homework_make_up",
    "homework_score_updated",
    "exam_opened",
    "exam_will_start",
    "exam_submit_started"
  ]

  return {
    all: notifications.length,
    activity_opened: notifications.filter((n) => n.type === "activity_opened")
      .length,
    homework_opened_for_submission: notifications.filter(
      (n) =>
        n.type === "homework_opened_for_submission" ||
        n.type === "course_homework_make_up"
    ).length,
    homework_score_updated: notifications.filter(
      (n) => n.type === "homework_score_updated"
    ).length,
    exam_will_start: notifications.filter(
      (n) =>
        n.type === "exam_opened" ||
        n.type === "exam_will_start" ||
        n.type === "exam_submit_started"
    ).length,
    others: notifications.filter((n) => !mainTypes.includes(n.type)).length
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

/**
 * Card that lists notifications with a type filter and optional mark-as-read and undo actions.
 * @param props Title, notifications, active filter and its setter, badge visibility, read actions and loading state.
 */
export function NotificationCard({
  title,
  notifications,
  filter,
  onFilterChange,
  showBadges = false,
  onMarkRead,
  onUndoMarkRead,
  isLoading = false,
  error = null,
  onRetry,
  tempReadTypes
}: NotificationCardProps) {
  const filteredNotifications = filterNotifications(notifications, filter)
  const counts = calculateCounts(notifications)
  // The header action covers what is on screen: every category, or just the selected one.
  const scope: readonly string[] =
    filter === "all" ? MARKABLE_FILTERS : [filter]
  const scopeLabel =
    FILTER_OPTIONS.find((option) => option.type === filter)?.label ?? ""
  // Same rule as the tab badges: a category still counts until it has been marked.
  const hasUnmarked = scope.some(
    (f) => (counts[f] || 0) > 0 && !isFilterMarked(f, tempReadTypes)
  )
  const markLabel =
    filter === "all" ? "全部标为已读" : `将「${scopeLabel}」标为已读`
  const doneLabel = filter === "all" ? "已全部标为已读" : "已标为已读"

  return (
    <Card className="flex flex-col min-h-0 overflow-hidden border-transparent">
      <CardHeader className="pb-4 flex-shrink-0 flex-row items-center justify-between space-y-0 gap-3">
        <CardTitle className="text-lg font-semibold">
          {title}
          {!isLoading && !error && (
            <span className="ml-2 font-normal text-muted-foreground tabular-nums">
              {notifications.length}
            </span>
          )}
        </CardTitle>
        {onMarkRead && (
          // Unmarked items first; otherwise offer the undo; otherwise nothing to do.
          // bg-transparent keeps the school site's own disabled-button fill out.
          <Button
            variant="ghost"
            size="sm"
            className="bg-transparent text-muted-foreground hover:bg-accent disabled:bg-transparent"
            disabled={isLoading || !!error || (!hasUnmarked && !onUndoMarkRead)}
            onClick={
              hasUnmarked || !onUndoMarkRead
                ? () => onMarkRead(scope)
                : onUndoMarkRead
            }>
            {hasUnmarked || isLoading
              ? markLabel
              : onUndoMarkRead
                ? "撤销标为已读"
                : doneLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
        <div className="flex-shrink-0">
          <FilterTabs
            activeFilter={filter}
            onFilterChange={onFilterChange}
            counts={counts}
            showBadges={showBadges}
            tempReadTypes={tempReadTypes}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="pr-2">
            {isLoading ? (
              <LoadingSkeleton />
            ) : error ? (
              <div
                role="alert"
                className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground">{error}</p>
                {onRetry && (
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    重试
                  </Button>
                )}
              </div>
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
