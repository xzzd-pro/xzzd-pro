import * as React from "react"
import { CourseGrid } from "@/components/course/CourseGrid"
import { CourseSearchForm } from "@/components/course/CourseSearchForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AllCourse } from "@/components/ui/course-list"

interface CoursePageProps {
  courses: AllCourse[]
  loading?: boolean
  onSearch: (filters: { keyword: string; status: string[] }) => void
}

export function CoursePage({ courses, loading = false, onSearch }: CoursePageProps) {
  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Search Form Card */}
      <Card className="flex-shrink-0">
        <CardHeader>
          <CardTitle>课程搜索</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <CourseSearchForm onSearch={onSearch} />
        </CardContent>
      </Card>

      {/* Courses Grid Card */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle>我的课程</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto p-6">
          <CourseGrid courses={courses} loading={loading} />
        </CardContent>
      </Card>
    </div>
  )
}
