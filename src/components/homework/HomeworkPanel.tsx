import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { HomeworkContent } from "./HomeworkContent"
import { getUserId } from "@/lib/components/courseDetailHelpers"
import type { HomeworkApiResponse, HomeworkActivity, ProcessedHomework } from "@/types"

// Fetch homework list
async function fetchHomeworkList(courseId: string): Promise<HomeworkActivity[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/courses/${courseId}/homework-activities`
    )
    if (!response.ok) return []
    const data: HomeworkApiResponse = await response.json()
    return data.homework_activities || []
  } catch (error) {
    console.error('XZZDPRO: 获取作业列表时出错', error)
    return []
  }
}

// Process homework list
function processHomeworks(homeworks: HomeworkActivity[], courseId: string): ProcessedHomework[] {
  const processed = homeworks.map(hw => ({
    id: hw.id,
    title: hw.title,
    score: hw.score,
    submitted: hw.submitted,
    isClosed: hw.is_closed,
    endTime: hw.end_time,
    deadline: new Date(hw.end_time),
    scorePublished: hw.score_published,
    link: `https://courses.zju.edu.cn/course/${courseId}/learning-activity#/${hw.id}`
  }))

  return processed.sort((a, b) => {
    if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1
    if (!a.isClosed) return a.deadline.getTime() - b.deadline.getTime()
    return b.deadline.getTime() - a.deadline.getTime()
  })
}

// Skeleton loader
function HomeworkSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="w-6 h-6 rounded" />
              <div className="flex-1">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <Skeleton className="h-6 w-3/4 max-w-[300px]" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </div>
                <div className="pt-3 border-t border-border">
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

interface HomeworkPanelProps {
  courseId: string
}

export function HomeworkPanel({ courseId }: HomeworkPanelProps) {
  const [homeworks, setHomeworks] = React.useState<ProcessedHomework[]>([])
  const [userId, setUserId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError(null)

      try {
        const uid = await getUserId()
        if (!uid) {
          setError('无法获取用户信息')
          return
        }
        setUserId(uid)

        const homeworkList = await fetchHomeworkList(courseId)
        const processed = processHomeworks(homeworkList, courseId)
        setHomeworks(processed)
      } catch (err) {
        setError('加载作业列表失败，请刷新重试')
        console.error('XZZDPRO: 加载作业时出错', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [courseId])

  if (isLoading) {
    return <HomeworkSkeleton />
  }

  if (error) {
    return (
      <p className="text-center text-destructive py-10 text-base">
        {error}
      </p>
    )
  }

  if (homeworks.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-10 text-base">
        暂无作业
      </p>
    )
  }

  const formatDeadline = (deadline: Date, isClosed: boolean): string => {
    if (isClosed) return `已于 ${deadline.toLocaleDateString('zh-CN')} 截止`
    const now = new Date()
    const diff = deadline.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (days > 0) return `还剩 ${days} 天 ${hours} 小时`
    if (hours > 0) {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      return `还剩 ${hours} 小时 ${minutes} 分钟`
    }
    return '即将截止'
  }

  return (
    <Accordion type="multiple" className="w-full space-y-4">
      {homeworks.map(homework => (
        <Card key={homework.id} className="overflow-hidden transition-all duration-200 hover:shadow-md">
          <AccordionItem
            value={homework.id.toString()}
            className="border-none"
          >
            <AccordionTrigger className="flex items-start gap-3 p-6 hover:bg-muted/50 transition-colors [&[data-state=open]>svg]:rotate-180">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <h3 className="flex-1 min-w-0">
                    <a
                      href={homework.link}
                      className="text-xl font-semibold text-foreground hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {homework.title}
                    </a>
                  </h3>
                  <div className="flex gap-2 flex-shrink-0">
                    <Badge variant={homework.isClosed ? "secondary" : "default"}>
                      {homework.isClosed ? '已结束' : '进行中'}
                    </Badge>
                    <Badge
                      variant={homework.submitted ? "default" : "outline"}
                      className={cn(!homework.submitted && "bg-yellow-500 text-gray-900 border-transparent")}
                    >
                      {homework.submitted ? '已提交' : '未提交'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-6 flex-wrap pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">截止时间:</span>
                    <span className={cn(
                      "text-[15px] font-semibold",
                      !homework.isClosed && "text-destructive animate-pulse"
                    )}>
                      {formatDeadline(homework.deadline, homework.isClosed)}
                    </span>
                  </div>
                  {homework.scorePublished && homework.submitted && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">成绩:</span>
                      <span className="text-lg font-bold text-primary">{homework.score}</span>
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pl-[60px]">
              <HomeworkContent homework={homework} userId={userId!} />
            </AccordionContent>
          </AccordionItem>
        </Card>
      ))}
    </Accordion>
  )
}
