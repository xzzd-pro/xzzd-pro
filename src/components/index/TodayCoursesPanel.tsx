import * as React from "react"
import { CourseList, type TodayCourse } from "@/components/ui/course-list"

interface TodayCoursesPanelProps {
  courses: TodayCourse[]
  loading?: boolean
}

export function TodayCoursesPanel({
  courses,
  loading = false,
}: TodayCoursesPanelProps) {
  return (
    <CourseList
      courses={courses}
      variant="today"
      loading={loading}
      emptyMessage="今天没有课哦 ~"
    />
  )
}

export type { TodayCourse }
