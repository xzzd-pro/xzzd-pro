import * as React from "react"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProcessedNotification } from "../../types"

const NOTIFICATION_TYPE_NAMES: Record<string, string> = {
  'activity_opened': '新文件发布',
  'homework_opened_for_submission': '新作业发布',
  'course_homework_make_up': '补交作业',
  'homework_score_updated': '作业成绩发布',
  'exam_opened': '测验已开放',
  'exam_will_start': '测验即将开始',
  'exam_submit_started': '测验已开始'
}

export interface NotificationItemProps {
  notification: ProcessedNotification
}

function getScoreStyles(score: string | undefined): string {
  if (score === undefined || score === null) return ''
  const numScore = parseFloat(score)
  if (isNaN(numScore)) return ''

  if (numScore >= 90) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
  if (numScore >= 80) return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
  if (numScore >= 70) return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400'
  if (numScore >= 60) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
  return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const typeName = NOTIFICATION_TYPE_NAMES[notification.type] || notification.type
  const scoreStyles = getScoreStyles(notification.score)
  const hasScore = notification.score !== undefined && notification.score !== null

  return (
    <a
      href={notification.link}
      className={cn(
        "block no-underline cursor-pointer group"
      )}
    >
      <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/50">
        <CardHeader className="p-3 pb-1">
          <div className="flex justify-between items-center gap-2">
            <Badge variant="secondary" className="shrink-0 text-xs">
              {typeName}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {notification.time}
            </span>
          </div>
          <div className="text-lg font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {notification.title}
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground truncate">
                {notification.courseName}
              </span>
              {hasScore && (
                <Badge variant="outline" className={cn("text-xs font-semibold shrink-0", scoreStyles)}>
                  {notification.score}分
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  )
}
