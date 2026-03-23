import * as React from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getUserId } from "@/lib/components/courseDetailHelpers"
import { cn } from "@/lib/utils"
import type {
  HomeworkActivity,
  HomeworkApiResponse,
  HomeworkScoreItem,
  HomeworkScoresResponse,
  ProcessedHomework
} from "@/types"
import { HomeworkContent } from "./HomeworkContent"

async function fetchHomeworkList(courseId: string): Promise<HomeworkActivity[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/courses/${courseId}/homework-activities?conditions=%7B%22itemsSortBy%22:%7B%22predicate%22:%22module%22,%22reverse%22:false%7D%7D&page=1&page_size=100&reloadPage=false`
    )

    if (!response.ok) return []

    const data: HomeworkApiResponse = await response.json()
    return data.homework_activities || []
  } catch (error) {
    console.error("XZZDPRO: failed to fetch homework list", error)
    return []
  }
}

async function fetchHomeworkScores(
  courseId: string
): Promise<HomeworkScoreItem[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/course/${courseId}/homework-scores`
    )

    if (!response.ok) return []

    const data: HomeworkScoresResponse = await response.json()
    return data.scores || []
  } catch (error) {
    console.error("XZZDPRO: failed to fetch homework scores", error)
    return []
  }
}

function resolveHomeworkScore(
  score?: string | null,
  finalScore?: number | null
): string {
  const normalizedScore = (score || "").trim()
  if (normalizedScore) return normalizedScore
  if (finalScore !== null && finalScore !== undefined) return String(finalScore)
  return ""
}

function hasReviewResult(scoreItem?: HomeworkScoreItem): boolean {
  if (!scoreItem) return false

  return Boolean(
    resolveHomeworkScore(scoreItem.score, scoreItem.final_score) ||
      scoreItem.instructor_comment?.trim()
  )
}

function processHomeworks(
  homeworks: HomeworkActivity[],
  scoreItems: HomeworkScoreItem[],
  courseId: string
): ProcessedHomework[] {
  const scoreMap = new Map<number, HomeworkScoreItem>()
  scoreItems.forEach((item) => {
    scoreMap.set(item.activity_id, item)
  })

  const processed = homeworks.map((hw) => ({
    ...(() => {
      const scoreItem = scoreMap.get(hw.id)
      const resolvedScore =
        resolveHomeworkScore(scoreItem?.score, scoreItem?.final_score) ||
        (hw.score || "").trim()
      const instructorComment = scoreItem?.instructor_comment?.trim() || ""
      const isReviewed =
        hasReviewResult(scoreItem) || Boolean(resolvedScore && hw.submitted)

      return {
        score: resolvedScore,
        scorePublished: hw.score_published || isReviewed,
        isReviewed,
        instructorComment
      }
    })(),
    id: hw.id,
    title: hw.title,
    submitted: hw.submitted,
    isClosed: hw.is_closed,
    endTime: hw.end_time,
    deadline: new Date(hw.end_time),
    link: `https://courses.zju.edu.cn/course/${courseId}/learning-activity#/${hw.id}`
  }))

  return processed.sort((a, b) => {
    if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1
    if (!a.isClosed) return a.deadline.getTime() - b.deadline.getTime()
    return b.deadline.getTime() - a.deadline.getTime()
  })
}

type DeadlineVariant = "overdue" | "urgent" | "soon" | "normal"

function getDeadlineInfo(
  deadline: Date,
  isClosed: boolean
): {
  variant: DeadlineVariant
  text: string
} | null {
  if (isClosed) return null

  const diff = deadline.getTime() - Date.now()
  if (diff <= 0) {
    return { variant: "overdue", text: "\u5df2\u622a\u6b62" }
  }

  const totalMinutesLeft = Math.max(1, Math.ceil(diff / (1000 * 60)))
  const daysLeft = Math.floor(totalMinutesLeft / (60 * 24))
  const remainingMinutesAfterDays = totalMinutesLeft % (60 * 24)
  const hoursLeft = Math.floor(remainingMinutesAfterDays / 60)
  const minutesLeft = remainingMinutesAfterDays % 60

  const paddedHours = String(hoursLeft).padStart(2, "0")
  const paddedMinutes = String(minutesLeft).padStart(2, "0")
  const timeText =
    `\u5269\u4f59 ${daysLeft}\u5929${paddedHours}\u5c0f\u65f6${paddedMinutes}\u5206\u949f`

  if (diff <= 3 * 24 * 60 * 60 * 1000) {
    return { variant: "urgent", text: timeText }
  }

  if (diff <= 7 * 24 * 60 * 60 * 1000) {
    return { variant: "soon", text: timeText }
  }

  return { variant: "normal", text: timeText }
}

function formatAbsoluteDeadline(deadline: Date): string {
  return deadline.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
}

function HomeworkSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="overflow-hidden border-border/70">
          <CardHeader className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-4/5 max-w-[360px]" />
                  <Skeleton className="h-4 w-2/5 max-w-[220px]" />
                </div>
                <Skeleton className="mt-1 h-4 w-4" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
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
          setError("\u65e0\u6cd5\u83b7\u53d6\u7528\u6237\u4fe1\u606f")
          return
        }

        setUserId(uid)

        const [homeworkList, homeworkScores] = await Promise.all([
          fetchHomeworkList(courseId),
          fetchHomeworkScores(courseId)
        ])
        const processed = processHomeworks(
          homeworkList,
          homeworkScores,
          courseId
        )
        setHomeworks(processed)
      } catch (err) {
        setError("\u52a0\u8f7d\u4f5c\u4e1a\u5217\u8868\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5")
        console.error("XZZDPRO: failed to load homework data", err)
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [courseId])

  if (isLoading) {
    return <HomeworkSkeleton />
  }

  if (error) {
    return <p className="py-10 text-center text-base text-destructive">{error}</p>
  }

  if (homeworks.length === 0) {
    return (
      <p className="py-10 text-center text-base text-muted-foreground">
        {"\u6682\u65e0\u4f5c\u4e1a"}
      </p>
    )
  }

  return (
    <Accordion type="multiple" className="w-full space-y-3">
      {homeworks.map((homework) => {
        const deadlineInfo = getDeadlineInfo(homework.deadline, homework.isClosed)

        return (
          <Card
            key={homework.id}
            className={cn(
              "overflow-hidden border border-border/70 bg-card/95 shadow-sm transition-all duration-200",
              "hover:border-primary/30 hover:shadow-md",
              !homework.isClosed && "hover:-translate-y-0.5"
            )}
          >
            <AccordionItem value={homework.id.toString()} className="border-none">
              <AccordionTrigger className="items-start gap-3 bg-transparent px-4 py-3 text-left hover:bg-muted/20 hover:no-underline [&>svg]:mt-1 [&>svg]:text-muted-foreground">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <h3 className="line-clamp-2 text-lg font-semibold leading-6 text-foreground">
                        {homework.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {`\u622a\u6b62\u65f6\u95f4\uff1a${formatAbsoluteDeadline(homework.deadline)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <Badge
                        variant={homework.isClosed ? "secondary" : "outline"}
                        className={cn(
                          "border-transparent text-xs",
                          !homework.isClosed && "border-primary/20 bg-primary/10 text-primary"
                        )}
                      >
                        {homework.isClosed ? "\u5df2\u7ed3\u675f" : "\u8fdb\u884c\u4e2d"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          homework.submitted
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300"
                            : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300"
                        )}
                      >
                        {homework.submitted ? "\u5df2\u63d0\u4ea4" : "\u672a\u63d0\u4ea4"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {deadlineInfo ? (
                      <Badge variant={deadlineInfo.variant} className="text-xs">
                        {deadlineInfo.text}
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {"\u5df2\u622a\u6b62"}
                      </span>
                    )}
                    {homework.submitted && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                          homework.isReviewed
                            ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {homework.isReviewed
                          ? "\u5df2\u6279\u6539"
                          : "\u672a\u6279\u6539"}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {homework.scorePublished
                        ? "\u5df2\u53d1\u5e03\u6210\u7ee9"
                        : "\u6210\u7ee9\u672a\u53d1\u5e03"}
                    </span>
                    {homework.isReviewed && homework.score && (
                      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {`\u6210\u7ee9\uff1a${homework.score}`}
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 !pb-0 pt-0">
                <div className="border-t border-border/70 pt-4">
                  <HomeworkContent homework={homework} userId={userId!} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Card>
        )
      })}
    </Accordion>
  )
}
