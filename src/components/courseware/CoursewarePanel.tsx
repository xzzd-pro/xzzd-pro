import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CoursewareContent } from "./CoursewareContent"
import type { CoursewareActivity, ProcessedCoursewareSection, ProcessedCoursewareFile } from "@/types"

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

// Process coursewares into sections
function processCourseware(activities: CoursewareActivity[]): ProcessedCoursewareSection[] {
  return activities.map(activity => ({
    id: activity.id,
    title: activity.title,
    isStarted: activity.is_started,
    isClosed: activity.is_closed,
    completionCriterion: activity.completion_criterion || '无要求',
    files: (activity.uploads || []).map(upload => ({
      id: upload.id,
      name: upload.name,
      size: upload.size,
      sizeText: formatFileSize(upload.size),
      canDownload: upload.allow_download,
      downloadUrl: `https://courses.zju.edu.cn/api/uploads/${upload.id}/blob`
    }))
  }))
}

// Fetch coursewares for a course
async function fetchCoursewares(courseId: string): Promise<CoursewareActivity[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/course/${courseId}/coursewares`
    )

    if (!response.ok) {
      console.error('XZZDPRO: 获取课件失败', response.status)
      return []
    }

    const data = await response.json()
    return data.activities || []
  } catch (error) {
    console.error('XZZDPRO: 获取课件时出错', error)
    return []
  }
}

// Skeleton loader component
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

export function CoursewarePanel({ courseId }: CoursewarePanelProps) {
  const [sections, setSections] = React.useState<ProcessedCoursewareSection[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function loadCoursewares() {
      setIsLoading(true)
      setError(null)

      try {
        const activities = await fetchCoursewares(courseId)
        const processedSections = processCourseware(activities)
        setSections(processedSections)
      } catch (err) {
        setError('加载课件失败，请刷新重试')
        console.error('XZZDPRO: 加载课件时出错', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadCoursewares()
  }, [courseId])

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
    <Accordion type="multiple" className="w-full space-y-3">
      {sections.map((section, index) => {
        const statusVariant = section.isClosed ? 'secondary' : (section.isStarted ? 'default' : 'outline')
        const statusText = section.isClosed ? '已关闭' : (section.isStarted ? '进行中' : '未开始')

        return (
          <Card key={section.id} className="overflow-hidden">
            <AccordionItem
              value={section.id.toString()}
              className="border-none"
            >
              <AccordionTrigger className="flex items-center gap-3 p-5 hover:bg-muted/50 transition-colors [&[data-state=open]>svg]:rotate-180">
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
                <CoursewareContent section={section} />
              </AccordionContent>
            </AccordionItem>
          </Card>
        )
      })}
    </Accordion>
  )
}
