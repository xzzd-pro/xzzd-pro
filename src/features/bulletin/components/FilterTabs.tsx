import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { typesForFilter } from "../readState"

export interface FilterTabsProps {
  activeFilter: string
  onFilterChange: (filter: string) => void
  counts?: Record<string, number>
  showBadges?: boolean
  tempReadTypes?: Set<string>
}

export const FILTER_OPTIONS = [
  { type: "all", label: "全部" },
  { type: "activity_opened", label: "新文件" },
  { type: "homework_opened_for_submission", label: "新作业" },
  { type: "homework_score_updated", label: "作业成绩" },
  { type: "exam_will_start", label: "测验开始" },
  { type: "others", label: "其他" }
]

/** A category marked read this session keeps its items in place until reload but loses its badge. */
export function isFilterMarked(
  filter: string,
  tempReadTypes?: Set<string>
): boolean {
  return (
    !!tempReadTypes?.size &&
    typesForFilter(filter).some((key) => tempReadTypes.has(key))
  )
}

/**
 * Category filters. Choosing one only filters the list; marking as read is a
 * separate action in the card header. Unread counts sit as corner badges; the
 * total lives in the card title, so "全部" carries none.
 */
export function FilterTabs({
  activeFilter,
  onFilterChange,
  counts = {},
  showBadges = false,
  tempReadTypes
}: FilterTabsProps) {
  return (
    <div className="flex gap-2 pt-2 mb-6 flex-wrap">
      {FILTER_OPTIONS.map(({ type, label }) => {
        const isActive = activeFilter === type
        const count = counts[type] || 0
        const showBadge =
          showBadges &&
          type !== "all" &&
          count > 0 &&
          !isFilterMarked(type, tempReadTypes)

        return (
          <Button
            key={type}
            variant="outline"
            aria-pressed={isActive}
            onClick={() => onFilterChange(type)}
            className={cn(
              "relative h-8 px-3 text-sm font-medium text-muted-foreground",
              isActive &&
                "bg-secondary text-foreground border-foreground/25 font-semibold hover:bg-secondary"
            )}>
            {label}
            {showBadge && (
              <span
                className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold leading-5 text-center ring-2 ring-card"
                aria-label={`${count} 条未读`}>
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Button>
        )
      })}
    </div>
  )
}
