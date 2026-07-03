import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { downloadCoursewareZip } from "@/features/courseware/coursewareDownload"
import { formatFileSize } from "@/lib/fileFormat"
import { cn } from "@/lib/utils"
import { ChevronDown, Download, Loader2 } from "lucide-react"
import { CoursewareContent } from "./CoursewareContent"
import type {
  CourseModule,
  CourseModulesResponse,
  CoursewareActivity,
  CoursewareApiResponse,
  ProcessedCoursewareSection
} from "@/types"

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null

  const normalized = typeof value === "number" ? value : Number(value)
  return Number.isFinite(normalized) ? normalized : null
}

function getActivityModuleId(activity: CoursewareActivity): number | null {
  return toFiniteNumber(activity.module_id) ?? toFiniteNumber(activity.module?.id)
}

function sortCoursewaresByModule(
  activities: CoursewareActivity[],
  modules: CourseModule[]
): CoursewareActivity[] {
  const moduleOrder = new Map<number, { sort: number; index: number }>()

  modules.forEach((courseModule, index) => {
    moduleOrder.set(courseModule.id, {
      sort: toFiniteNumber(courseModule.sort) ?? index,
      index
    })
  })

  return activities
    .map((activity, index) => ({ activity, index }))
    .sort((left, right) => {
      const leftModuleId = getActivityModuleId(left.activity)
      const rightModuleId = getActivityModuleId(right.activity)
      const leftModule =
        leftModuleId === null ? undefined : moduleOrder.get(leftModuleId)
      const rightModule =
        rightModuleId === null ? undefined : moduleOrder.get(rightModuleId)
      const leftModuleSort = leftModule?.sort ?? Number.POSITIVE_INFINITY
      const rightModuleSort = rightModule?.sort ?? Number.POSITIVE_INFINITY

      if (leftModuleSort !== rightModuleSort) {
        return leftModuleSort - rightModuleSort
      }
      if (leftModule && rightModule && leftModule.index !== rightModule.index) {
        return leftModule.index - rightModule.index
      }

      const leftActivitySort = toFiniteNumber(left.activity.sort)
      const rightActivitySort = toFiniteNumber(right.activity.sort)
      if (
        leftActivitySort !== null &&
        rightActivitySort !== null &&
        leftActivitySort !== rightActivitySort
      ) {
        return leftActivitySort - rightActivitySort
      }

      return left.index - right.index
    })
    .map(({ activity }) => activity)
}

function processCourseware(
  activities: CoursewareActivity[],
  modules: CourseModule[]
): ProcessedCoursewareSection[] {
  const moduleNameMap = new Map(
    modules.map((courseModule) => [courseModule.id, courseModule.name])
  )

  return sortCoursewaresByModule(activities, modules).map((activity) => {
    const moduleId = getActivityModuleId(activity)

    return {
      id: activity.id,
      title: activity.title,
      moduleName: moduleId === null ? undefined : moduleNameMap.get(moduleId),
      isStarted: activity.is_started,
      isClosed: activity.is_closed,
      completionCriterion: activity.completion_criterion || "无要求",
      files: (activity.uploads || []).map((upload) => ({
        id: upload.id,
        name: upload.name,
        size: upload.size,
        sizeText: formatFileSize(upload.size),
        canDownload: upload.allow_download,
        downloadUrl: `https://courses.zju.edu.cn/api/uploads/${upload.id}/blob`
      }))
    }
  })
}

function buildCoursewareListUrl(courseId: string): string {
  const conditions = encodeURIComponent(
    JSON.stringify({
      category: null,
      itemsSortBy: {
        predicate: "chapter",
        reverse: false
      },
      ignore_activity_types: ["lesson"]
    })
  )

  return `https://courses.zju.edu.cn/api/course/${courseId}/coursewares?conditions=${conditions}&page=1&page_size=1000`
}

async function fetchCoursewares(courseId: string): Promise<CoursewareActivity[]> {
  try {
    const response = await fetch(buildCoursewareListUrl(courseId), {
      credentials: "include"
    })

    if (!response.ok) {
      console.error("XZZDPRO: failed to fetch coursewares", response.status)
      return []
    }

    const data: CoursewareApiResponse = await response.json()
    return data.activities || []
  } catch (error) {
    console.error("XZZDPRO: failed to fetch coursewares", error)
    return []
  }
}

async function fetchCourseModules(courseId: string): Promise<CourseModule[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/courses/${courseId}/modules`,
      { credentials: "include" }
    )

    if (!response.ok) {
      console.error("XZZDPRO: failed to fetch course modules", response.status)
      return []
    }

    const data: CourseModulesResponse = await response.json()
    return data.modules || []
  } catch (error) {
    console.error("XZZDPRO: failed to fetch course modules", error)
    return []
  }
}

function CoursewareSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="w-6 h-6 rounded" />
              <div className="flex-1">
                <Skeleton className="h-5 w-3/4 max-w-[300px] mb-3" />
                <div className="flex gap-3">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

interface CoursewarePanelProps {
  courseId: string
}

type CoursewareDownloadTarget =
  | { type: "all"; completed: number; total: number }
  | { type: "selected"; completed: number; total: number }
  | { type: "section"; sectionId: number; completed: number; total: number }

export function CoursewarePanel({ courseId }: CoursewarePanelProps) {
  const [sections, setSections] = React.useState<ProcessedCoursewareSection[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [downloadTarget, setDownloadTarget] =
    React.useState<CoursewareDownloadTarget | null>(null)
  const [downloadError, setDownloadError] = React.useState<string | null>(null)
  const [selectedFileIds, setSelectedFileIds] = React.useState<Set<number>>(
    () => new Set()
  )
  const [openSectionIds, setOpenSectionIds] = React.useState<Set<number>>(
    () => new Set()
  )

  React.useEffect(() => {
    async function loadCoursewares() {
      setIsLoading(true)
      setError(null)
      setDownloadError(null)

      try {
        const [activities, modules] = await Promise.all([
          fetchCoursewares(courseId),
          fetchCourseModules(courseId)
        ])
        const nextSections = processCourseware(activities, modules)
        const downloadableIds = new Set(
          nextSections.flatMap((section) =>
            section.files
              .filter((file) => file.canDownload)
              .map((file) => file.id)
          )
        )

        setSections(nextSections)
        setSelectedFileIds(
          (previous) =>
            new Set([...previous].filter((fileId) => downloadableIds.has(fileId)))
        )
        setOpenSectionIds(
          (previous) =>
            new Set(
              [...previous].filter((sectionId) =>
                nextSections.some((section) => section.id === sectionId)
              )
            )
        )
      } catch (err) {
        setError("加载课件失败，请刷新重试")
        console.error("XZZDPRO: failed to load coursewares", err)
      } finally {
        setIsLoading(false)
      }
    }

    void loadCoursewares()
  }, [courseId])

  const allDownloadableEntries = sections.flatMap((section) =>
    section.files
      .filter((file) => file.canDownload)
      .map((file) => ({
        file,
        folder: section.title
      }))
  )
  const selectedDownloadableEntries = allDownloadableEntries.filter((entry) =>
    selectedFileIds.has(entry.file.id)
  )
  const isDownloading = downloadTarget !== null
  const progressText = downloadTarget
    ? `${downloadTarget.completed}/${downloadTarget.total}`
    : ""

  const handleFileSelectionChange = (fileId: number, selected: boolean) => {
    setSelectedFileIds((previous) => {
      const next = new Set(previous)
      if (selected) {
        next.add(fileId)
      } else {
        next.delete(fileId)
      }

      return next
    })
  }

  const handleClearSelection = () => {
    setSelectedFileIds(new Set())
  }

  const handleSectionOpenChange = (sectionId: number, open: boolean) => {
    setOpenSectionIds((previous) => {
      const next = new Set(previous)
      if (open) {
        next.add(sectionId)
      } else {
        next.delete(sectionId)
      }

      return next
    })
  }

  const handleDownloadAll = async () => {
    if (allDownloadableEntries.length === 0 || isDownloading) return

    setDownloadError(null)
    setDownloadTarget({
      type: "all",
      completed: 0,
      total: allDownloadableEntries.length
    })

    try {
      await downloadCoursewareZip({
        archiveName: `courseware-${courseId}.zip`,
        entries: allDownloadableEntries,
        onProgress: (completed, total) =>
          setDownloadTarget({ type: "all", completed, total })
      })
    } catch (err) {
      console.error("XZZDPRO: failed to download courseware zip", err)
      setDownloadError("批量下载失败，请稍后重试")
    } finally {
      setDownloadTarget(null)
    }
  }

  const handleDownloadSelected = async () => {
    if (selectedDownloadableEntries.length === 0 || isDownloading) return

    setDownloadError(null)
    setDownloadTarget({
      type: "selected",
      completed: 0,
      total: selectedDownloadableEntries.length
    })

    try {
      await downloadCoursewareZip({
        archiveName: `courseware-selected-${courseId}.zip`,
        entries: selectedDownloadableEntries,
        onProgress: (completed, total) =>
          setDownloadTarget({ type: "selected", completed, total })
      })
    } catch (err) {
      console.error("XZZDPRO: failed to download selected coursewares", err)
      setDownloadError("选中文件下载失败，请稍后重试")
    } finally {
      setDownloadTarget(null)
    }
  }

  const handleDownloadSection = async (
    section: ProcessedCoursewareSection
  ) => {
    const entries = section.files
      .filter((file) => file.canDownload)
      .map((file) => ({
        file,
        folder: section.title
      }))
    if (entries.length === 0 || isDownloading) return

    setDownloadError(null)
    setDownloadTarget({
      type: "section",
      sectionId: section.id,
      completed: 0,
      total: entries.length
    })

    try {
      await downloadCoursewareZip({
        archiveName: `${section.title}.zip`,
        entries,
        onProgress: (completed, total) =>
          setDownloadTarget({
            type: "section",
            sectionId: section.id,
            completed,
            total
          })
      })
    } catch (err) {
      console.error("XZZDPRO: failed to download courseware section", err)
      setDownloadError("章节下载失败，请稍后重试")
    } finally {
      setDownloadTarget(null)
    }
  }

  if (isLoading) {
    return <CoursewareSkeleton />
  }

  if (error) {
    return (
      <p className="text-center text-destructive py-10 text-base">
        {error}
      </p>
    )
  }

  if (sections.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-10 text-base">
        暂无课件
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/95 p-4 shadow-sm">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">批量下载</div>
          <div className="text-xs text-muted-foreground">
            共 {allDownloadableEntries.length} 个可下载文件，已选{" "}
            {selectedDownloadableEntries.length} 个
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {downloadError && (
            <span className="text-sm text-destructive">{downloadError}</span>
          )}
          {selectedDownloadableEntries.length > 0 && !isDownloading && (
            <Button size="sm" variant="ghost" onClick={handleClearSelection}>
              清空选择
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={isDownloading || selectedDownloadableEntries.length === 0}
            onClick={handleDownloadSelected}>
            {downloadTarget?.type === "selected" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>
              {downloadTarget?.type === "selected"
                ? `打包中 ${progressText}`
                : "下载选中文件"}
            </span>
          </Button>
          <Button
            size="sm"
            disabled={isDownloading || allDownloadableEntries.length === 0}
            onClick={handleDownloadAll}>
            {downloadTarget?.type === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>
              {downloadTarget?.type === "all"
                ? `打包中 ${progressText}`
                : "下载全部"}
            </span>
          </Button>
        </div>
      </div>

      <div className="w-full space-y-3">
        {sections.map((section) => {
          const statusVariant = section.isClosed
            ? "secondary"
            : section.isStarted
              ? "default"
              : "outline"
          const statusText = section.isClosed
            ? "已关闭"
            : section.isStarted
              ? "进行中"
              : "未开始"
          const sectionDownloadTarget =
            downloadTarget?.type === "section" &&
            downloadTarget.sectionId === section.id
              ? downloadTarget
              : null
          const isOpen = openSectionIds.has(section.id)

          return (
            <Card key={section.id} className="overflow-hidden">
              <Collapsible
                open={isOpen}
                onOpenChange={(open) =>
                  handleSectionOpenChange(section.id, open)
                }>
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 bg-card p-5 text-left transition-colors hover:bg-muted/50 data-[state=open]:bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground leading-snug mb-2">
                      {section.title}
                    </h3>
                    <div className="flex gap-4 flex-wrap text-[13px]">
                      <Badge
                        variant={statusVariant}
                        className={cn(
                          section.isClosed &&
                            "bg-muted-foreground text-white border-transparent",
                          !section.isStarted &&
                            !section.isClosed &&
                            "bg-yellow-500 text-gray-900 border-transparent"
                        )}>
                        {statusText}
                      </Badge>
                      {section.moduleName && (
                        <span className="text-muted-foreground flex items-center">
                          {section.moduleName}
                        </span>
                      )}
                      <span className="text-muted-foreground flex items-center">
                        {section.completionCriterion}
                      </span>
                      <span className="text-muted-foreground flex items-center">
                        {section.files.length} 个文件
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent unmountOnExit>
                  <div className="px-5 pb-5 pl-14">
                    <CoursewareContent
                      section={section}
                      downloading={Boolean(sectionDownloadTarget)}
                      downloadDisabled={isDownloading && !sectionDownloadTarget}
                      downloadProgress={
                        sectionDownloadTarget
                          ? `${sectionDownloadTarget.completed}/${sectionDownloadTarget.total}`
                          : undefined
                      }
                      selectedFileIds={selectedFileIds}
                      onFileSelectionChange={handleFileSelectionChange}
                      onDownloadSection={() => void handleDownloadSection(section)}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
