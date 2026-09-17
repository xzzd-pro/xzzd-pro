// Local visual QA only. Uses synthetic data; never connects to the school APIs.
import React from "react"
import { createRoot } from "react-dom/client"
import { renderCourseDetailPage } from "../../src/shared/course-detail/courseDetailHelpers"
import { setupSidebarToggle, setupThemeToggle, setupHelpModal } from "../../src/shared/layout"
import { CoursewarePanel } from "../../src/features/courseware/components/CoursewarePanel"
import { HomeworkPanel } from "../../src/features/homework/components/HomeworkPanel"
import { ScoreBoardView } from "../../src/features/score-board/components/ScoreBoardView"
import courseware from "./courseware-fixture.json"
import scores from "./score-fixture.json"
import { CoursePage } from "../../src/features/courses/components/CoursePage"

const previewCourses = [
  { id: 701, name: '信号与系统', display_name: '信号与系统', semester: { id: 21, name: '2025-2026秋冬学期' }, status: 'closed', instructors: [{ id: 1, name: '示例教师' }], course_attributes: { teaching_class_name: '教学班一' } },
  { id: 702, name: '信号处理', display_name: '信号处理', semester: { id: 22, name: '2025-2026春夏学期' }, status: 'ongoing', instructors: [{ id: 1, name: '示例教师' }], course_attributes: { teaching_class_name: '教学班二' } },
  { id: 703, name: '电路分析', display_name: '电路分析', semester: { id: 22, name: '2025-2026春夏学期' }, status: 'notStarted', instructors: [{ id: 2, name: '测试教师' }], course_attributes: { teaching_class_name: '教学班三' } }
]
function CourseFilterPreview() { return <CoursePage courses={previewCourses} /> }

const params = new URLSearchParams(location.search)
const page = params.get("page") || "materials"
if (page === "courses") {
  const stylesheet = document.createElement("link")
  stylesheet.rel = "stylesheet"
  stylesheet.href = "./course-page.css"
  document.head.appendChild(stylesheet)
}
const dark = params.get("theme") === "dark"
document.documentElement.dataset.theme = dark ? "dark" : "light"
document.documentElement.classList.toggle("dark", dark)
localStorage.setItem("theme", JSON.stringify(dark ? "dark" : "light"))
document.body.className = "xzzdpro-body xzzdpro"
document.body.innerHTML = '<div class="xzzdpro-root xzzdpro"></div>'
const root = document.querySelector<HTMLDivElement>(".xzzdpro-root")!
const names: Record<string, string> = { materials: "课件下载", homework: "作业提交", grades: "成绩", courses: "课程筛选预览" }
root.innerHTML = renderCourseDetailPage("123", "信号与系统", page, names[page], '<div id="preview-panel" class="' + (page === 'homework' ? 'homework-list' : '') + '"></div>')
// Avoid loading the remote school logo in this isolated preview.
root.querySelector(".logo-link")!.innerHTML = '<span style="font-size:22px;font-weight:600">学在浙大</span>'
root.querySelector("#user-avatar-container")!.innerHTML = '<span style="display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:hsl(var(--muted));color:hsl(var(--primary))">学</span>'

window.fetch = async (input, options) => {
  const url = new URL(String(input), "https://courses.zju.edu.cn")
  const fixture = courseware.responses.find(item => item.pathname === url.pathname)
  let data: unknown = fixture?.body
  if (page === 'courses' && url.pathname.startsWith('/api/courses/')) data = previewCourses.find(course => url.pathname === `/api/courses/${course.id}`)
  if (url.pathname === '/api/my-courses') {
    const status = options?.body ? JSON.parse(String(options.body)).conditions.status : []
    data = { courses: page === 'courses' ? previewCourses.filter(course => !status.length || status.includes(course.status)) : [{ id: 123 }] }
  }
  if (url.pathname.endsWith('/activity-reads-for-user')) data = { activity_reads: [{ created_by_id: 456 }] }
  if (url.pathname.endsWith('/homework-activities')) data = { homework_activities: [
    { id: 201, title: '习题一：信号的基本运算', start_time: '2020-01-01', end_time: '2030-09-27T23:59:00', is_closed: false, submitted: false, score_published: false },
    { id: 202, title: '实验报告：连续时间系统分析', start_time: '2020-01-01', end_time: '2030-10-08T23:59:00', is_closed: false, submitted: true, score_published: false },
    { id: 203, title: '预习作业', start_time: '2020-01-01', end_time: '2020-09-09T23:59:00', is_closed: true, submitted: true, score_published: true, score: '95' }
  ] }
  if (url.pathname.endsWith('/homework-scores')) data = { scores: [] }
  if (url.pathname.startsWith('/api/activities/') && !url.pathname.endsWith('/submission_list')) data = {
    title: '习题一', data: { description: '' }, uploads: [{ id: 601, name: '信号与系统 习题一.pdf', size: 63000, allow_download: true }]
  }
  if (url.pathname.endsWith('/submission_list')) data = { list: [] }
  if (!data) throw new Error('Preview blocks unmocked request: ' + url.pathname)
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
}

setupThemeToggle()
setupHelpModal()
void setupSidebarToggle()
if (params.get('collapsed') === 'true') {
  root.classList.add('sidebar-collapsed')
  root.style.gridTemplateColumns = '72px 1fr'
}
createRoot(document.getElementById('preview-panel')!).render(
  page === 'courses' ? <CourseFilterPreview /> :
  page === 'materials' ? <CoursewarePanel courseId="123" /> :
  page === 'homework' ? <HomeworkPanel courseId="123" /> :
  <ScoreBoardView data={scores as any} />
)
