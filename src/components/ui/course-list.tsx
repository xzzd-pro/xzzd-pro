import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatClassTimes } from "@/lib/class-times"
import { cn } from "@/lib/utils"

export interface TodayCourse {
  parsedName: string
  parsedTeacher: string
  parsedLocation: string
  periodStr: string
  timeRange: string
  link: string
}

export interface AllCourse {
  id: number
  name: string
  display_name: string
  instructors: Array<{ id: number; name: string }>
  course_attributes: {
    teaching_class_name: string
  }
  /** Semester as reported by the course list API (label in `code`). */
  semester?: {
    id: string | number
    code?: string | null
    name?: string | null
  } | null
  /** Display name of the course's semester, if it has one. */
  semesterName?: string
  /** Course status, once the status lookup has finished. */
  status?: CourseStatus
}

export type CourseStatus = "ongoing" | "notStarted" | "closed"

const STATUS_LABELS: Record<CourseStatus, string> = {
  ongoing: "进行中",
  notStarted: "未开始",
  closed: "已结束"
}

interface CourseListProps {
  courses: TodayCourse[] | AllCourse[]
  variant: "today" | "all"
  loading?: boolean
  emptyMessage?: string
}

function isTodayCourse(course: TodayCourse | AllCourse): course is TodayCourse {
  return "parsedName" in course
}

function CourseCardSkeleton({ variant }: { variant: "today" | "all" }) {
  if (variant === "today") {
    return (
      <Card>
        <CardHeader className="p-3 pb-1">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <Skeleton className="h-4 w-4/5" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="course-card">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-4 w-2/5" />
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </Card>
  )
}

function TodayCourseCard({ course }: { course: TodayCourse }) {
  const CardWrapper = course.link && course.link !== "#" ? "a" : "div"
  const linkProps =
    course.link && course.link !== "#"
      ? { href: course.link, target: "_blank", rel: "noopener noreferrer" }
      : {}

  return (
    <CardWrapper
      {...linkProps}
      className={cn(
        "block no-underline",
        course.link && course.link !== "#" && "cursor-pointer group"
      )}>
      <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/50">
        <CardHeader className="p-3 pb-1">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
              {course.parsedName}
            </CardTitle>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {course.periodStr}节 ({course.timeRange})
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-0">
            <p className="text-sm text-muted-foreground">
              地点： {course.parsedLocation || "未知地点"} | 老师：{" "}
              {course.parsedTeacher}
            </p>
          </div>
        </CardContent>
      </Card>
    </CardWrapper>
  )
}

function generateCourseUrl(courseId: number): string {
  if (!courseId) return "#"
  return `https://courses.zju.edu.cn/course/${courseId}/content#/`
}

function AllCourseCard({ course }: { course: AllCourse }) {
  const courseName = course.display_name || course.name
  const instructors = course.instructors.map((i) => i.name).join("、")
  const classTimes = formatClassTimes(
    course.course_attributes?.teaching_class_name
  )
  const courseUrl = generateCourseUrl(course.id)

  return (
    <a
      href={courseUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full no-underline">
      <Card className="course-card h-full">
        <div className="flex items-start justify-between gap-3">
          <h3
            className="course-card-title truncate font-semibold"
            title={courseName}>
            {courseName}
          </h3>
          {course.semesterName && (
            <Badge variant="secondary" className="shrink-0 text-xs font-normal">
              {course.semesterName}
            </Badge>
          )}
        </div>
        <p className="course-card-teacher truncate" title={instructors}>
          {instructors || "暂无授课教师信息"}
        </p>
        {(course.status || classTimes.length > 0) && (
          <div className="course-card-tags">
            {course.status && (
              <span className="course-status-tag" data-status={course.status}>
                {STATUS_LABELS[course.status]}
              </span>
            )}
            {classTimes.map((time) => (
              <span key={time} className="course-time-tag">
                {time}
              </span>
            ))}
          </div>
        )}
      </Card>
    </a>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}

/**
 * List of course cards, with loading skeletons and an empty state.
 * @param props Courses to show, the card variant (today's or all courses), loading flag and empty-state message.
 */
export function CourseList({
  courses,
  variant,
  loading = false,
  emptyMessage
}: CourseListProps) {
  const defaultEmptyMessage =
    variant === "today" ? "今天没有课哦 ~" : "未找到符合条件的课程"

  if (loading) {
    return (
      <div
        className={cn(
          "space-y-3",
          variant === "all" && "grid grid-cols-1 md:grid-cols-2 gap-4 space-y-0"
        )}>
        {Array.from({ length: variant === "all" ? 4 : 3 }).map((_, i) => (
          <CourseCardSkeleton key={i} variant={variant} />
        ))}
      </div>
    )
  }

  if (courses.length === 0) {
    return <EmptyState message={emptyMessage || defaultEmptyMessage} />
  }

  if (variant === "today") {
    return (
      <div className="space-y-3">
        {(courses as TodayCourse[]).map((course, index) => (
          <TodayCourseCard key={index} course={course} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {(courses as AllCourse[]).map((course) => (
        <AllCourseCard key={course.id} course={course} />
      ))}
    </div>
  )
}

export { TodayCourseCard, AllCourseCard, CourseCardSkeleton, EmptyState }
