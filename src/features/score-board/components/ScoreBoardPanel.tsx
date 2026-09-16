import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ScoreBoardView, type ScoreData } from "./ScoreBoardView"
import { getUserId } from "@/shared/course-detail/courseDetailHelpers"
import type {
  AnnounceScoreSettingsResponse,
  RollcallsResponse,
  RollcallItem,
  PerformanceScoreResponse,
  CustomScoreItemsResponse,
  CustomScoreItem,
  HomeworkScoresResponse,
  ExamScoresResponse,
  ExamsResponse,
  ExamInfo,
  ForumScoreItem,
  ForumScoresResponse,
  ClassroomScoreItem,
  ClassroomScoresResponse,
  QuestionnaireScoreItem,
  QuestionnaireScoresResponse
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

async function fetchForumScores(courseId: string): Promise<ForumScoreItem[]> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/course/${courseId}/forum-scores`)
    if (!response.ok) return []
    const data: ForumScoresResponse = await response.json()
    return data.forum_scores || []
  } catch (error) {
    console.error('XZZDPRO: 获取讨论成绩时出错', error)
    return []
  }
}

async function fetchClassroomExamScores(courseId: string): Promise<ClassroomScoreItem[]> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/course/${courseId}/classroom-exam-scores`)
    if (!response.ok) return []
    const data: ClassroomScoresResponse = await response.json()
    return data.classroom_scores || []
  } catch (error) {
    console.error('XZZDPRO: 获取课堂测试成绩时出错', error)
    return []
  }
}

async function fetchQuestionnaireScores(courseId: string): Promise<QuestionnaireScoreItem[]> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/course/${courseId}/questionnaire-scores`)
    if (!response.ok) return []
    const data: QuestionnaireScoresResponse = await response.json()
    return data.questionnaire_scores || []
  } catch (error) {
    console.error('XZZDPRO: 获取问卷成绩时出错', error)
    return []
  }
}

// Loading follows the same compact hierarchy as the final page.
function ScoreBoardSkeleton() {
  return <div className="grid gap-5" role="status" aria-label="正在加载成绩">
    <Skeleton className="h-32 rounded-xl" />
    <div className="grid gap-5 md:grid-cols-2">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
    <Skeleton className="h-64 rounded-xl" />
  </div>
}
// Main Component
interface ScoreBoardPanelProps {
  courseId: string
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
          exams,
          forumScores,
          classroomScores,
          questionnaireScores
        ] = await Promise.all([
          fetchAnnounceScoreSettings(courseId),
          fetchRollcalls(courseId, userId),
          fetchPerformanceScore(courseId),
          fetchCustomScoreItems(courseId),
          fetchHomeworkScores(courseId),
          fetchExamScores(courseId),
          fetchExams(courseId),
          fetchForumScores(courseId),
          fetchClassroomExamScores(courseId),
          fetchQuestionnaireScores(courseId)
        ])

        setData({
          announceSettings,
          rollcalls,
          performanceScore,
          customScoreItems,
          homeworkScores,
          examScores,
          exams,
          forumScores,
          classroomScores,
          questionnaireScores
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

  return <ScoreBoardView data={data} />
}
