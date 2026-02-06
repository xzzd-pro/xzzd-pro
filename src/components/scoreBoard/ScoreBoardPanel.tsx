import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getUserId } from "@/lib/components/courseDetailHelpers"
import type {
  AnnounceScoreSettingsResponse,
  RollcallsResponse,
  RollcallItem,
  PerformanceScoreResponse,
  CustomScoreItemsResponse,
  CustomScoreItem,
  HomeworkScoresResponse,
  HomeworkScoreActivity,
  HomeworkScoreItem,
  ExamScoresResponse,
  ExamsResponse,
  ExamInfo
} from "@/types"

// API functions
async function fetchAnnounceScoreSettings(courseId: string): Promise<AnnounceScoreSettingsResponse | null> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}/announce-score-settings`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('XZZDPRO: 获取总成绩设置时出错', error)
    return null
  }
}

async function fetchRollcalls(courseId: string, studentId: string): Promise<RollcallItem[]> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/course/${courseId}/student/${studentId}/rollcalls`)
    if (!response.ok) return []
    const data: RollcallsResponse = await response.json()
    return data.rollcalls || []
  } catch (error) {
    console.error('XZZDPRO: 获取考勤成绩时出错', error)
    return []
  }
}

async function fetchPerformanceScore(courseId: string): Promise<PerformanceScoreResponse | null> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/course/${courseId}/performance-score`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('XZZDPRO: 获取课堂表现成绩时出错', error)
    return null
  }
}

async function fetchCustomScoreItems(courseId: string): Promise<CustomScoreItem[]> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}/custom-score-items`)
    if (!response.ok) return []
    const data: CustomScoreItemsResponse = await response.json()
    return data.custom_score_items || []
  } catch (error) {
    console.error('XZZDPRO: 获取自定义成绩项时出错', error)
    return []
  }
}

async function fetchHomeworkScores(courseId: string): Promise<HomeworkScoresResponse | null> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/course/${courseId}/homework-scores`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('XZZDPRO: 获取作业成绩时出错', error)
    return null
  }
}

async function fetchExamScores(courseId: string): Promise<ExamScoresResponse | null> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}/exam-scores`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('XZZDPRO: 获取测试成绩时出错', error)
    return null
  }
}

async function fetchExams(courseId: string): Promise<ExamInfo[]> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}/exams`)
    if (!response.ok) return []
    const data: ExamsResponse = await response.json()
    return data.exams || []
  } catch (error) {
    console.error('XZZDPRO: 获取测试列表时出错', error)
    return []
  }
}

// Helper functions
function formatTime(isoTime: string): string {
  const date = new Date(isoTime)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Section Components
function TotalScoreSection({ settings }: { settings: AnnounceScoreSettingsResponse | null }) {
  if (!settings) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">总成绩</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">无法获取总成绩信息</p>
        </CardContent>
      </Card>
    )
  }

  const finalAnnounced = settings.announce_score_settings.announce_score_type !== 'no_announce'
  const rawAnnounced = settings.announce_score_settings.announce_raw_score_type !== 'no_announce'

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">总成绩</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex justify-between items-center p-4 bg-card border rounded-lg">
            <span className="font-medium">最终成绩</span>
            <Badge variant={finalAnnounced ? "default" : "secondary"}>
              {finalAnnounced ? '已公布' : '未公布'}
            </Badge>
          </div>
          <div className="flex justify-between items-center p-4 bg-card border rounded-lg">
            <span className="font-medium">原始成绩</span>
            <Badge variant={rawAnnounced ? "default" : "secondary"}>
              {rawAnnounced ? '已公布' : '未公布'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RollcallSection({ rollcalls }: { rollcalls: RollcallItem[] }) {
  if (rollcalls.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">考勤成绩</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">暂无考勤记录</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">考勤成绩</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[1fr_100px_100px] gap-4 px-4 py-3 bg-card border-b text-sm font-semibold text-muted-foreground">
          <span>签到时间</span>
          <span className="text-center">出勤状态</span>
          <span className="text-center">是否计分</span>
        </div>
        <div className="divide-y divide-border">
          {rollcalls.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_100px_100px] gap-4 px-4 py-3 items-center">
              <span className="text-sm">{formatTime(item.rollcall_time)}</span>
              <div className="text-center">
                <Badge variant={item.status === 'on_call_fine' ? "default" : "destructive"}>
                  {item.status === 'on_call_fine' ? '正常' : '缺勤'}
                </Badge>
              </div>
              <span className={`text-center text-sm font-medium ${item.scored ? 'text-primary' : 'text-muted-foreground'}`}>
                {item.scored ? '计分' : '不计分'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PerformanceSection({ performance }: { performance: PerformanceScoreResponse | null }) {
  if (!performance) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">课堂表现成绩</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">无法获取课堂表现信息</p>
        </CardContent>
      </Card>
    )
  }

  const announced = performance.announce_score_setting !== 'no_announce'
  const percentageDisplay = parseFloat(performance.score_percentage) > 0
    ? `${performance.score_percentage}%`
    : '0%'

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">课堂表现成绩</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-2 p-4 bg-card border rounded-lg">
            <span className="text-sm text-muted-foreground">公布状态</span>
            <Badge variant={announced ? "default" : "secondary"} className="w-fit">
              {announced ? '已公布' : '未公布'}
            </Badge>
          </div>
          <div className="flex flex-col gap-2 p-4 bg-card border rounded-lg">
            <span className="text-sm text-muted-foreground">成绩</span>
            <span className="text-2xl font-bold text-primary">
              {performance.score !== null ? performance.score : '--'}
            </span>
          </div>
          <div className="flex flex-col gap-2 p-4 bg-card border rounded-lg">
            <span className="text-sm text-muted-foreground">成绩占比</span>
            <span className="text-lg font-semibold">{percentageDisplay}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CustomScoreSection({ items }: { items: CustomScoreItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">自定义成绩项</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">暂无自定义成绩项</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">自定义成绩项</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[1fr_100px_100px] gap-4 px-4 py-3 bg-card border-b text-sm font-semibold text-muted-foreground">
          <span>名称</span>
          <span className="text-center">得分</span>
          <span className="text-center">成绩占比</span>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_100px_100px] gap-4 px-4 py-3 items-center">
              <span className="text-sm font-medium">{item.name}</span>
              <span className="text-center text-base font-bold text-primary">{item.score || '--'}</span>
              <span className="text-center text-sm text-muted-foreground">
                {parseFloat(item.score_percentage) > 0 ? `${item.score_percentage}%` : '0%'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityScoresSection({
  homeworkData,
  examScores,
  exams
}: {
  homeworkData: HomeworkScoresResponse | null
  examScores: ExamScoresResponse | null
  exams: ExamInfo[]
}) {
  const hasHomework = homeworkData && homeworkData.homework_activities.length > 0
  const hasExams = examScores && examScores.exam_scores.length > 0 && exams.length > 0

  // Create score map for homework
  const scoreMap = new Map<number, HomeworkScoreItem>()
  if (homeworkData) {
    homeworkData.scores.forEach(s => scoreMap.set(s.activity_id, s))
  }

  // Create exam info map
  const examMap = new Map<number, ExamInfo>()
  exams.forEach(exam => {
    const match = exam.unique_key.match(/exam-(\d+)/)
    if (match) {
      examMap.set(parseInt(match[1]), exam)
    }
  })

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">学习活动成绩</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Homework Section */}
        <div>
          <h4 className="text-[15px] font-semibold mb-3">作业</h4>
          {hasHomework ? (
            <>
              <div className="grid grid-cols-[1fr_80px_80px_1fr] gap-4 px-4 py-3 bg-card border rounded-t-lg text-sm font-semibold text-muted-foreground">
                <span>名称</span>
                <span className="text-center">成绩</span>
                <span className="text-center">占比</span>
                <span>老师评语</span>
              </div>
              <div className="divide-y divide-border bg-card border border-t-0 rounded-b-lg">
                {homeworkData.homework_activities.map(activity => {
                  const scoreItem = scoreMap.get(activity.id)
                  return (
                    <div key={activity.id} className="grid grid-cols-[1fr_80px_80px_1fr] gap-4 px-4 py-3 items-center">
                      <span className="text-sm font-medium">{activity.title}</span>
                      <span className="text-center text-[15px] font-bold text-primary">
                        {scoreItem?.score || '--'}
                      </span>
                      <span className="text-center text-sm text-muted-foreground">
                        {parseFloat(activity.score_percentage) > 0 ? `${activity.score_percentage}%` : '0%'}
                      </span>
                      <span className="text-sm text-muted-foreground truncate" title={scoreItem?.instructor_comment || ''}>
                        {scoreItem?.instructor_comment || '--'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-center py-4">暂无作业成绩</p>
          )}
        </div>

        {/* Exam Section */}
        <div>
          <h4 className="text-[15px] font-semibold mb-3">测试</h4>
          {hasExams ? (
            <>
              <div className="grid grid-cols-[1fr_100px] gap-4 px-4 py-3 bg-card border rounded-t-lg text-sm font-semibold text-muted-foreground">
                <span>名称</span>
                <span className="text-center">得分</span>
              </div>
              <div className="divide-y divide-border bg-card border border-t-0 rounded-b-lg">
                {examScores.exam_scores.map(scoreItem => {
                  const examInfo = examMap.get(scoreItem.activity_id)
                  return (
                    <div key={scoreItem.activity_id} className="grid grid-cols-[1fr_100px] gap-4 px-4 py-3 items-center">
                      <span className="text-sm font-medium">{examInfo?.title || `测试 #${scoreItem.activity_id}`}</span>
                      <span className="text-center text-base font-bold text-primary">
                        {scoreItem.score !== null ? scoreItem.score : '--'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-center py-4">暂无测试成绩</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Skeleton
function ScoreBoardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Main Component
interface ScoreBoardPanelProps {
  courseId: string
}

interface ScoreData {
  announceSettings: AnnounceScoreSettingsResponse | null
  rollcalls: RollcallItem[]
  performanceScore: PerformanceScoreResponse | null
  customScoreItems: CustomScoreItem[]
  homeworkScores: HomeworkScoresResponse | null
  examScores: ExamScoresResponse | null
  exams: ExamInfo[]
}

export function ScoreBoardPanel({ courseId }: ScoreBoardPanelProps) {
  const [data, setData] = React.useState<ScoreData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function loadScores() {
      setIsLoading(true)
      setError(null)

      try {
        const userId = await getUserId()
        if (!userId) {
          setError('无法获取用户信息')
          return
        }

        const [
          announceSettings,
          rollcalls,
          performanceScore,
          customScoreItems,
          homeworkScores,
          examScores,
          exams
        ] = await Promise.all([
          fetchAnnounceScoreSettings(courseId),
          fetchRollcalls(courseId, userId),
          fetchPerformanceScore(courseId),
          fetchCustomScoreItems(courseId),
          fetchHomeworkScores(courseId),
          fetchExamScores(courseId),
          fetchExams(courseId)
        ])

        setData({
          announceSettings,
          rollcalls,
          performanceScore,
          customScoreItems,
          homeworkScores,
          examScores,
          exams
        })
      } catch (err) {
        setError('加载成绩数据失败，请刷新重试')
        console.error('XZZDPRO: 加载成绩时出错', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadScores()
  }, [courseId])

  if (isLoading) {
    return <ScoreBoardSkeleton />
  }

  if (error) {
    return (
      <p className="text-center text-destructive py-10 text-base">
        {error}
      </p>
    )
  }

  if (!data) {
    return (
      <p className="text-center text-muted-foreground py-10 text-base">
        无法加载成绩数据
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <TotalScoreSection settings={data.announceSettings} />
      <RollcallSection rollcalls={data.rollcalls} />
      <PerformanceSection performance={data.performanceScore} />
      <CustomScoreSection items={data.customScoreItems} />
      <ActivityScoresSection
        homeworkData={data.homeworkScores}
        examScores={data.examScores}
        exams={data.exams}
      />
    </div>
  )
}
