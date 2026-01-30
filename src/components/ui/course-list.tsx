import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
    <Card className="h-[100px]">
      <CardHeader className="p-3 pb-1">
        <Skeleton className="h-5 w-4/5" />
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-1">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
      </CardContent>
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
      )}
    >
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
  const teachingClass = course.course_attributes?.teaching_class_name || ""
  const courseUrl = generateCourseUrl(course.id)

  return (
    <a
      href={courseUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block no-underline"
    >
      <Card className="h-[100px] transition-all duration-200 hover:shadow-md hover:border-primary/50 group">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
            {courseName}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-0">
            <p className="text-sm text-muted-foreground truncate leading-none mb-0">
              授课老师： {instructors}
            </p>
            {teachingClass && (
              <p className="text-sm text-muted-foreground truncate leading-none mt-0">
                上课时间： {teachingClass}
              </p>
            )}
          </div>
        </CardContent>
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

export function CourseList({
  courses,
  variant,
  loading = false,
  emptyMessage,
}: CourseListProps) {
  const defaultEmptyMessage =
    variant === "today" ? "今天没有课哦 ~" : "未找到符合条件的课程"

  if (loading) {
    return (
      <div
        className={cn(
          "space-y-3",
          variant === "all" && "grid grid-cols-1 md:grid-cols-2 gap-4 space-y-0"
        )}
      >
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
