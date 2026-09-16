import * as React from "react"
import type {
  AnnounceScoreSettingsResponse, RollcallItem, PerformanceScoreResponse,
  CustomScoreItem, HomeworkScoresResponse, ExamScoresResponse, ExamInfo,
  ForumScoreItem, ClassroomScoreItem, QuestionnaireScoreItem
} from "@/types"
import { scoreBoardStyles } from "./scoreBoardStyles"

export interface ScoreData {
  announceSettings: AnnounceScoreSettingsResponse | null
  rollcalls: RollcallItem[]
  performanceScore: PerformanceScoreResponse | null
  customScoreItems: CustomScoreItem[]
  homeworkScores: HomeworkScoresResponse | null
  examScores: ExamScoresResponse | null
  exams: ExamInfo[]
  forumScores: ForumScoreItem[]
  classroomScores: ClassroomScoreItem[]
  questionnaireScores: QuestionnaireScoreItem[]
}

const displayScore = (score: number | string | null | undefined) =>
  score === null || score === undefined || score === "" ? "—" : score
const displayWeight = (weight: string) => parseFloat(weight) > 0 ? `${weight}%` : "0%"

function Publication({ announced }: { announced: boolean }) {
  return <span className={`score-board-status${announced ? " is-published" : ""}`}>
    <span aria-hidden="true" />{announced ? "已公布" : "未公布"}
  </span>
}

interface ActivityRow {
  id: number
  title: string
  score: number | string | null | undefined
  weight?: string
  comment?: string
}

function ActivityScores({ data }: { data: ScoreData }) {
  const [activeTab, setActiveTab] = React.useState("homework")
  const homeworkMap = new Map(data.homeworkScores?.scores.map(item => [item.activity_id, item]))
  const examMap = new Map<number, ExamInfo>()
  data.exams.forEach(exam => {
    const match = exam.unique_key.match(/exam-(\d+)/)
    if (match) examMap.set(Number(match[1]), exam)
  })
  const groups: { key: string; label: string; rows: ActivityRow[]; hasWeight?: boolean; hasComment?: boolean }[] = [
    { key: "homework", label: "作业", hasWeight: true, hasComment: true, rows: data.homeworkScores?.homework_activities.map(item => ({
      id: item.id, title: item.title, score: homeworkMap.get(item.id)?.score,
      weight: item.score_percentage, comment: homeworkMap.get(item.id)?.instructor_comment
    })) || [] },
    { key: "exam", label: "测试", rows: data.exams.length ? data.examScores?.exam_scores.map(item => ({
      id: item.activity_id, title: examMap.get(item.activity_id)?.title || `测试 #${item.activity_id}`, score: item.score
    })) || [] : [] },
    { key: "classroom", label: "课堂测试", rows: data.classroomScores.map(item => ({
      id: item.activity_id, title: item.title || `课堂测试 #${item.activity_id}`, score: item.score
    })) },
    { key: "forum", label: "讨论", rows: data.forumScores.map(item => ({
      id: item.activity_id, title: item.title || `讨论 #${item.activity_id}`, score: item.score
    })) },
    { key: "questionnaire", label: "问卷", rows: data.questionnaireScores.map(item => ({
      id: item.activity_id, title: item.title || `问卷 #${item.activity_id}`, score: item.score
    })) }
  ]
  const active = groups.find(group => group.key === activeTab)!
  return <section className="score-board-section" aria-labelledby="score-activities-heading">
    <div className="score-board-section-heading">
      <div><h3 id="score-activities-heading">学习活动成绩</h3><p>查看各项活动得分与老师评语</p></div>
      <span className="score-board-note">— 表示暂无成绩</span>
    </div>
    <div className="score-board-filters" role="group" aria-label="活动类型">
      {groups.map(group => <button key={group.key} type="button" aria-pressed={activeTab === group.key}
        onClick={() => setActiveTab(group.key)} className={activeTab === group.key ? "is-active" : ""}>
        {group.label}<span>{group.rows.length}</span>
      </button>)}
    </div>
    {active.rows.length ? <div className="score-board-table-scroll" tabIndex={0} role="region" aria-label={`${active.label}成绩表`}>
      <table className="score-board-table"><thead><tr>
        <th scope="col">{active.label}名称</th><th scope="col" className="score-board-numeric">得分</th>
        {active.hasWeight && <th scope="col" className="score-board-numeric">占比</th>}
        {active.hasComment && <th scope="col" className="score-board-comment">老师评语</th>}
      </tr></thead><tbody>{active.rows.map(row => <tr key={row.id}>
        <td className="score-board-activity-name">{row.title}</td>
        <td className="score-board-numeric"><span className="score-board-value">{displayScore(row.score)}</span></td>
        {active.hasWeight && <td className="score-board-numeric score-board-muted">{displayWeight(row.weight || "0")}</td>}
        {active.hasComment && <td className="score-board-comment score-board-muted">{row.comment || "—"}</td>}
      </tr>)}</tbody></table>
    </div> : <p className="score-board-empty">暂无{active.label}成绩</p>}
  </section>
}

/** Presentation only: consumes server responses without estimating a total score. */
export function ScoreBoardView({ data }: { data: ScoreData }) {
  const settings = data.announceSettings?.announce_score_settings
  const performance = data.performanceScore
  const performancePublished = !!performance && performance.announce_score_setting !== "no_announce"
  return <div className="score-board-view">
    <style>{scoreBoardStyles}</style>
    <section className="score-board-overview" aria-labelledby="score-overview-heading">
      <div className="score-board-overview-intro"><span className="score-board-eyebrow">成绩总览</span>
        <h3 id="score-overview-heading">总成绩公布情况</h3><p>以课程公布的成绩信息为准</p>
      </div>
      {settings ? <div className="score-board-publications">
        <div><span>最终成绩</span><Publication announced={settings.announce_score_type !== "no_announce"} /></div>
        <div><span>原始成绩</span><Publication announced={settings.announce_raw_score_type !== "no_announce"} /></div>
      </div> : <p className="score-board-muted">无法获取总成绩信息</p>}
    </section>

    <div className="score-board-breakdown">
      <section className="score-board-section score-board-performance" aria-labelledby="score-performance-heading">
        <div className="score-board-section-heading"><h3 id="score-performance-heading">课堂表现</h3>
          {performance && <Publication announced={performancePublished} />}</div>
        {performance ? <div className="score-board-performance-body">
          <div><span className="score-board-metric-label">成绩</span><strong>{performancePublished ? displayScore(performance.score) : "—"}</strong></div>
          <div><span className="score-board-metric-label">成绩占比</span><b>{displayWeight(performance.score_percentage)}</b></div>
        </div> : <p className="score-board-empty">无法获取课堂表现信息</p>}
      </section>
      <section className="score-board-section" aria-labelledby="score-custom-heading">
        <div className="score-board-section-heading"><h3 id="score-custom-heading">自定义成绩项</h3><span className="score-board-note">{data.customScoreItems.length} 项</span></div>
        {data.customScoreItems.length ? <div className="score-board-table-scroll" tabIndex={0} role="region" aria-label="自定义成绩表">
          <table className="score-board-table"><thead><tr><th scope="col">名称</th><th scope="col" className="score-board-numeric">得分</th><th scope="col" className="score-board-numeric">占比</th></tr></thead>
            <tbody>{data.customScoreItems.map(item => <tr key={item.id}><td>{item.name}</td><td className="score-board-numeric"><span className="score-board-value">{displayScore(item.score)}</span></td><td className="score-board-numeric score-board-muted">{displayWeight(item.score_percentage)}</td></tr>)}</tbody>
          </table></div> : <p className="score-board-empty">暂无自定义成绩项</p>}
      </section>
    </div>

    <ActivityScores data={data} />

    <section className="score-board-section" aria-labelledby="score-attendance-heading">
      <div className="score-board-section-heading"><h3 id="score-attendance-heading">考勤记录</h3><span className="score-board-note">{data.rollcalls.length} 条记录</span></div>
      {data.rollcalls.length ? <div className="score-board-table-scroll" tabIndex={0} role="region" aria-label="考勤记录表">
        <table className="score-board-table"><thead><tr><th scope="col">签到时间</th><th scope="col" className="score-board-numeric">出勤状态</th><th scope="col" className="score-board-numeric">是否计分</th></tr></thead>
          <tbody>{data.rollcalls.map((item, index) => <tr key={item.rollcall_id || index}><td>{new Date(item.rollcall_time).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
            <td className="score-board-numeric"><span className={`score-board-attendance ${item.status === "on_call_fine" ? "is-normal" : "is-absent"}`}>{item.status === "on_call_fine" ? "正常" : "缺勤"}</span></td>
            <td className="score-board-numeric score-board-muted">{item.scored ? "计分" : "不计分"}</td></tr>)}</tbody>
        </table></div> : <p className="score-board-empty">暂无考勤记录</p>}
    </section>
  </div>
}
