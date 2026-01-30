import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface FilterTabsProps {
  activeFilter: string
  onFilterChange: (filter: string) => void
  counts?: Record<string, number>
  onMarkAsRead?: (type: string) => void
  showBadges?: boolean
}

const FILTER_OPTIONS = [
  { type: 'all', label: '全部' },
  { type: 'activity_opened', label: '新文件' },
  { type: 'homework_opened_for_submission', label: '新作业' },
  { type: 'homework_score_updated', label: '作业成绩' },
  { type: 'exam_will_start', label: '测验开始' },
  { type: 'others', label: '其他' },
]

export function FilterTabs({
  activeFilter,
  onFilterChange,
  counts = {},
  onMarkAsRead,
  showBadges = false
}: FilterTabsProps) {
  const handleClick = async (type: string) => {
    onFilterChange(type)

    // Mark as read when clicking non-"all" buttons (for unread panel)
    if (type !== 'all' && onMarkAsRead) {
      onMarkAsRead(type)
    }
  }

  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {FILTER_OPTIONS.map(({ type, label }) => {
        const isActive = activeFilter === type
        const count = counts[type] || 0
        const showBadge = showBadges && count > 0

        return (
          <Button
            key={type}
            variant={isActive ? "default" : "outline"}
            onClick={() => handleClick(type)}
            className="gap-2 text-sm font-medium"
          >
            {label}
            {showBadge && (
              <Badge
                variant={isActive ? "secondary" : "destructive"}
                className="ml-1 text-xs"
              >
                {count}
              </Badge>
            )}
          </Button>
        )
      })}
    </div>
  )
}
