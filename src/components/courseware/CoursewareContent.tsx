import * as React from "react"
import { CoursewareFileItem } from "./CoursewareFileItem"
import type { ProcessedCoursewareSection } from "@/types"

interface CoursewareContentProps {
  section: ProcessedCoursewareSection
}

export function CoursewareContent({ section }: CoursewareContentProps) {
  return (
    <div className="flex flex-col gap-3">
      {section.files.length > 0 ? (
        section.files.map((file) => (
          <CoursewareFileItem key={file.id} file={file} />
        ))
      ) : (
        <p className="text-muted-foreground text-sm py-4">该章节暂无课件</p>
      )}
    </div>
  )
}
