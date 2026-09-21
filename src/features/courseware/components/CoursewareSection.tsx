import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { CoursewareFileItem } from "./CoursewareFileItem"
import type { ProcessedCoursewareSection } from "@/types"

interface CoursewareSectionProps {
  section: ProcessedCoursewareSection
  defaultOpen?: boolean
  className?: string
}

export function CoursewareSection({ section, defaultOpen = false, className }: CoursewareSectionProps) {
  const statusClass = section.isClosed ? 'closed' : (section.isStarted ? 'started' : 'not-started')
  const statusText = section.isClosed ? '已关闭' : (section.isStarted ? '进行中' : '未开始')


  return (
    <AccordionItem
      value={section.id.toString()}
      className={cn(
        "bg-card rounded-lg overflow-hidden border border-border/70",
        "shadow-none",
        className
      )}
    >
      <AccordionTrigger className="flex items-center gap-3 p-5 hover:bg-border/50 transition-colors [&[data-state=open]>svg]:rotate-180">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground leading-snug mb-2">
            {section.title}
          </h3>
          <div className="flex gap-4 flex-wrap text-[13px]">
            <Badge
              variant="outline"
              className={cn(
                section.isClosed &&
                            "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
                          !section.isClosed && section.isStarted &&
                            "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
                !section.isStarted && !section.isClosed && "bg-muted text-muted-foreground border-border"
              )}
            >
              {statusText}
            </Badge>
            <span className="text-muted-foreground flex items-center">
              {section.completionCriterion}
            </span>
            <span className="text-muted-foreground flex items-center">
              {section.files.length} 个文件
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-3">
        <div className="flex flex-col divide-y divide-border/50">
          {section.files.length > 0 ? (
            section.files.map((file) => (
              <CoursewareFileItem key={file.id} file={file} />
            ))
          ) : (
            <p className="text-muted-foreground text-sm py-4">该章节暂无课件</p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
