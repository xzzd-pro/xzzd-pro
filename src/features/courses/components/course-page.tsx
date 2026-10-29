import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AllCourse } from "@/components/ui/course-list"

import {
  collectCourseSemesters,
  COURSE_STATUSES,
  filterCourses,
  type CourseFilters
} from "../course-filters"
import { collectCourseStatuses } from "../course-status-catalog"
import { CourseGrid } from "./course-grid"
import { CourseSearchForm } from "./course-search-form"

interface CoursePageProps {
  courses: AllCourse[]
  loading?: boolean
  /** Message shown instead of the course grid when the course list failed to load. */
  error?: string | null
  /** Reloads the course list after a failure. */
  onRetry?: () => void
}

/**
 * Course list page with keyword, status and semester filters.
 * @param props All courses, loading flag, and the load error with its retry callback.
 */
export function CoursePage({
  courses,
  loading = false,
  error = null,
  onRetry
}: CoursePageProps) {
  const [filters, setFilters] = React.useState<CourseFilters>({
    keyword: "",
    status: [...COURSE_STATUSES],
    semester_id: []
  })
  const [catalogCourses, setCatalogCourses] = React.useState<
    AllCourse[] | null
  >(null)
  const [selectedGroup, setSelectedGroup] = React.useState("")
  const [courseStatuses, setCourseStatuses] = React.useState<Map<
    number,
    Set<string>
  > | null>(null)
  const [statusWarning, setStatusWarning] = React.useState("")
  const [statusAttempt, setStatusAttempt] = React.useState(0)

  // Semesters come with the course list, so the filter is ready as soon as
  // the courses are.
  const ready = catalogCourses !== null
  const {
    options,
    latestId,
    warning: semesterWarning,
    courseSemesters,
    courseSemesterNames
  } = React.useMemo(
    () => collectCourseSemesters(catalogCourses || []),
    [catalogCourses]
  )
  const semesterIdsOf = (groupId: string) =>
    options.find((option) => option.id === groupId)?.semesterIds || []
  const warning = [semesterWarning, statusWarning].filter(Boolean).join(" ")

  React.useEffect(() => {
    // A failed load must not become the catalog, or retrying could not replace it.
    if (loading || error || catalogCourses !== null) return
    // Start on the latest semester; set together with the catalog so the
    // list does not first show every semester and then shrink.
    const latest = collectCourseSemesters(courses)
    const latestIds =
      latest.options.find((option) => option.id === latest.latestId)
        ?.semesterIds || []
    setSelectedGroup(latest.latestId)
    setFilters((previous) => ({ ...previous, semester_id: latestIds }))
    setCatalogCourses(courses)
  }, [loading, error, courses, catalogCourses])

  React.useEffect(() => {
    if (catalogCourses === null) return
    const controller = new AbortController()
    setStatusWarning("")
    setCourseStatuses(null)
    void collectCourseStatuses()
      .then((statuses) => {
        if (!controller.signal.aborted) setCourseStatuses(statuses)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatusWarning("课程状态加载失败，状态筛选暂不可用。")
      })
    return () => controller.abort()
  }, [catalogCourses, statusAttempt])

  const apply = (next: CourseFilters) => setFilters(next)
  const visibleCourses = filterCourses(
    catalogCourses || [],
    filters,
    courseSemesters,
    courseStatuses || new Map()
  ).map((course) => ({
    ...course,
    semesterName: courseSemesterNames.get(course.id)
  }))
  const totalCount = catalogCourses?.length ?? 0
  const countLabel =
    error || catalogCourses === null
      ? ""
      : visibleCourses.length === totalCount
        ? `共 ${totalCount} 门`
        : `找到 ${visibleCourses.length} 门，共 ${totalCount} 门`

  const statusOptions = [
    { value: "ongoing", label: "进行中" },
    { value: "notStarted", label: "未开始" },
    { value: "closed", label: "已结束" }
  ]
  return (
    <div className="course-catalog h-full flex flex-col space-y-6">
      <Card className="flex-shrink-0 border-transparent">
        <CardHeader>
          <CardTitle>课程搜索</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-5">
          <CourseSearchForm
            onSearch={(keyword) =>
              setFilters((previous) => ({ ...previous, keyword }))
            }
          />
          <div
            className="course-filter-row flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-4"
            aria-label="课程筛选">
            <div className="course-filter-group flex shrink-0 items-center gap-3">
              <label
                htmlFor="course-semester"
                className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
                上课学期
              </label>
              <select
                id="course-semester"
                disabled={!ready}
                value={selectedGroup}
                className="h-10 w-[210px] rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => {
                  setSelectedGroup(event.target.value)
                  apply({
                    ...filters,
                    semester_id: semesterIdsOf(event.target.value)
                  })
                }}>
                <option value="">{ready ? "全部学期" : "正在加载学期…"}</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="course-filter-group flex shrink-0 items-center gap-2"
              role="group"
              aria-label="课程状态">
              <span className="mr-1 shrink-0 whitespace-nowrap text-sm text-muted-foreground">
                状态
              </span>
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  disabled={!ready || !courseStatuses}
                  variant={
                    filters.status.includes(option.value)
                      ? "default"
                      : "outline"
                  }
                  className={
                    filters.status.includes(option.value)
                      ? "h-10"
                      : "h-10 text-foreground"
                  }
                  aria-pressed={filters.status.includes(option.value)}
                  onClick={() => {
                    const selected = filters.status.includes(option.value)
                      ? filters.status.filter((value) => value !== option.value)
                      : [...filters.status, option.value]
                    apply({
                      ...filters,
                      status: selected.length ? selected : [...COURSE_STATUSES]
                    })
                  }}>
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={!ready}
              className="ml-auto h-10 shrink-0 bg-transparent text-muted-foreground"
              onClick={() => {
                setSelectedGroup(latestId)
                apply({
                  ...filters,
                  status: [...COURSE_STATUSES],
                  semester_id: semesterIdsOf(latestId)
                })
              }}>
              重置筛选
            </Button>
          </div>
          {warning && (
            <p role="status" className="text-sm text-muted-foreground">
              {warning}{" "}
              {statusWarning && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="bg-transparent text-foreground"
                  onClick={() => setStatusAttempt((value) => value + 1)}>
                  重试
                </Button>
              )}
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-transparent">
        <CardHeader className="flex-shrink-0">
          <CardTitle>
            我的课程
            {countLabel && (
              <span
                aria-live="polite"
                className="ml-2 text-base font-normal text-muted-foreground tabular-nums">
                {countLabel}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto p-6">
          {error && !loading ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-muted-foreground">{error}</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  重试
                </Button>
              )}
            </div>
          ) : (
            <CourseGrid
              courses={visibleCourses}
              loading={loading || catalogCourses === null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
