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

  const statusVariant = section.isClosed ? 'secondary' : (section.isStarted ? 'default' : 'outline')

  return (
    <AccordionItem
      value={section.id.toString()}
      className={cn(
        "bg-muted rounded-lg overflow-hidden border-l-4 transition-shadow duration-200",
        "hover:shadow-md",
        section.isClosed ? "border-l-muted-foreground opacity-85" :
          section.isStarted ? "border-l-primary" : "border-l-yellow-500",
        className
      )}
    >
      <AccordionTrigger className="flex items-center gap-3 p-5 hover:bg-border/50 transition-colors [&[data-state=open]>svg]:rotate-180">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground leading-snug mb-2">
            {section.title}
          </h3>
          <div className="flex gap-4 flex-wrap text-[13px]">
            <Badge
              variant={statusVariant}
              className={cn(
                section.isClosed && "bg-muted-foreground text-white border-transparent",
                !section.isStarted && !section.isClosed && "bg-yellow-500 text-gray-900 border-transparent"
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
      <AccordionContent className="px-5 pb-5 pl-14">
        <div className="flex flex-col gap-3">
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
