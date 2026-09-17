import * as React from "react"
import { CourseGrid } from "./CourseGrid"
import { CourseSearchForm } from "./CourseSearchForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { AllCourse } from "@/components/ui/course-list"
import { COURSE_STATUSES, collectCourseSemesters, filterCourses, type CourseFilters, type SemesterOption } from "../courseFilters"

import { collectCourseStatuses } from "../courseStatusCatalog"

interface CoursePageProps {
  courses: AllCourse[]
  loading?: boolean
}

export function CoursePage({ courses, loading = false }: CoursePageProps) {
  const [options, setOptions] = React.useState<SemesterOption[]>([])
  const [ready, setReady] = React.useState(false)
  const [warning, setWarning] = React.useState("")
  const [attempt, setAttempt] = React.useState(0)
  const [filters, setFilters] = React.useState<CourseFilters>({ keyword: "", status: [...COURSE_STATUSES], semester_id: [] })
  const latestId = React.useRef("")
  const [catalogCourses, setCatalogCourses] = React.useState<AllCourse[] | null>(null)
  const [selectedGroup, setSelectedGroup] = React.useState("")
  const [courseSemesters, setCourseSemesters] = React.useState(new Map<number, string>())
  const [courseStatuses, setCourseStatuses] = React.useState<Map<number, Set<string>> | null>(null)
  const currentFilters = React.useRef(filters)
  currentFilters.current = filters

  React.useEffect(() => {
    if (!loading && catalogCourses === null) setCatalogCourses(courses)
  }, [loading, courses, catalogCourses])

  React.useEffect(() => {
    if (catalogCourses === null) return
    const controller = new AbortController()
    void Promise.all([collectCourseSemesters(catalogCourses, controller.signal), collectCourseStatuses().catch(() => null)]).then(([result, statuses]) => {
      if (controller.signal.aborted) return
      setOptions(result.options)
      setWarning([result.warning, statuses ? "" : "课程状态加载失败，可重试预加载。"].filter(Boolean).join(" "))
      setCourseSemesters(result.courseSemesters)
      setCourseStatuses(statuses)
      setSelectedGroup(result.latestId)
      latestId.current = result.latestId
      const next = { ...currentFilters.current, semester_id: result.options.find(option => option.id === result.latestId)?.semesterIds || [] }
      setFilters(next)
      setReady(true)
    }).catch(() => {
      if (!controller.signal.aborted) {
        setWarning("学期信息加载失败，请重试。")
        setReady(true)
      }
    })
    return () => controller.abort()
  }, [catalogCourses, attempt])

  const apply = (next: CourseFilters) => setFilters(next)
  const visibleCourses = filterCourses(catalogCourses || [], filters, courseSemesters, courseStatuses || new Map())
  const statusOptions = [{ value: "ongoing", label: "进行中" }, { value: "notStarted", label: "未开始" }, { value: "closed", label: "已结束" }]
  return (
    <div className="course-catalog h-full flex flex-col space-y-6">
      <Card className="flex-shrink-0">
        <CardHeader><CardTitle>课程搜索</CardTitle></CardHeader>
        <CardContent className="pt-2 space-y-5">
          <CourseSearchForm disabled={!ready} onSearch={keyword => apply({ ...filters, keyword })} />
          <div className="course-filter-row flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-4" aria-label="课程筛选">
            <div className="course-filter-group flex shrink-0 items-center gap-3">
              <label htmlFor="course-semester" className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">上课学期</label>
              <select id="course-semester" disabled={!ready} value={selectedGroup}
                className="h-10 w-[210px] rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={event => { setSelectedGroup(event.target.value); apply({ ...filters, semester_id: options.find(option => option.id === event.target.value)?.semesterIds || [] }) }}>
                <option value="">{ready ? "全部学期" : "正在加载学期…"}</option>
                {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </div>
            <div className="course-filter-group flex shrink-0 items-center gap-2" role="group" aria-label="课程状态">
              <span className="mr-1 shrink-0 whitespace-nowrap text-sm text-muted-foreground">状态</span>
              {statusOptions.map(option => <Button key={option.value} size="sm" disabled={!ready || !courseStatuses}
                variant={filters.status.includes(option.value) ? "default" : "outline"}
                className={filters.status.includes(option.value) ? "h-10" : "h-10 text-foreground"}
                aria-pressed={filters.status.includes(option.value)} onClick={() => {
                  const selected = filters.status.includes(option.value) ? filters.status.filter(value => value !== option.value) : [...filters.status, option.value]
                  apply({ ...filters, status: selected.length ? selected : [...COURSE_STATUSES] })
                }}>{option.label}</Button>)}
            </div>
            <Button variant="ghost" size="sm" disabled={!ready} className="ml-auto h-10 shrink-0 bg-transparent text-muted-foreground"
              onClick={() => { setSelectedGroup(latestId.current); apply({ ...filters, status: [...COURSE_STATUSES], semester_id: options.find(option => option.id === latestId.current)?.semesterIds || [] }) }}>重置筛选</Button>
          </div>
          {warning && <p role="status" className="text-sm text-muted-foreground">{warning} <Button size="sm" variant="ghost" className="bg-transparent text-foreground" disabled={!ready} onClick={() => { setReady(false); setAttempt(value => value + 1) }}>重试预加载</Button></p>}
        </CardContent>
      </Card>
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="flex-shrink-0"><CardTitle>我的课程</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto p-6"><CourseGrid courses={visibleCourses} loading={loading || !ready} /></CardContent>
      </Card>
    </div>
  )
}
