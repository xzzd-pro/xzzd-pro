import * as React from "react"
import { CourseList, type AllCourse } from "@/components/ui/course-list"

interface CourseGridProps {
  courses: AllCourse[]
  loading?: boolean
}

export function CourseGrid({ courses, loading = false }: CourseGridProps) {
  return (
    <CourseList
      courses={courses}
      variant="all"
      loading={loading}
      emptyMessage="未找到符合条件的课程"
    />
  )
}

export type { AllCourse }
