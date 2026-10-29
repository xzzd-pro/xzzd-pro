// lib/courseOverviewBeautifier.tsx

import { badgeVariants } from "@/components/ui/badge"
import { getDeadlineInfo } from "@/components/ui/todo-list"
import { fetchCoursewares } from "@/features/courseware/coursewareApi"
import { escapeHtml, sanitizeHtml } from "@/lib/html"
import { fetchTodos } from "@/shared/api/todos"
import { mountCourseDetailPage } from "@/shared/course-detail/courseDetailHelpers"

import {
  formatRelativeDay,
  pendingForCourse,
  recentUploads,
  type PendingItem,
  type RecentUpload
} from "./overviewActivity"

const PENDING_LIMIT = 6

interface Instructor {
  id: number
  name: string
  avatar_big_url?: string
  avatar_small_url?: string
  email?: string
}

interface CourseOutlineField {
  id?: number
  key: string
  title: string
  description: string
}

export interface CourseData {
  id: number
  display_name: string
  name: string
  course_code: string
  start_date: string | null
  department?: {
    id: number
    code: string
    name: string
  }
  semester?: {
    id: number
    code: string
    name: string
  }
  course_attributes?: {
    teaching_class_name?: string
    student_count?: number
  }
  instructors?: Instructor[]
  course_outline?: {
    common_fields?: CourseOutlineField[]
  }
}

// Generate skeleton loading HTML in the same two-column shape as the loaded page.
export function renderOverviewLoading(): string {
  const facts = Array(4)
    .fill("")
    .map(
      () => `
    <div class="overview-fact">
      <span class="skeleton-item skeleton-label"></span>
      <span class="skeleton-item skeleton-value"></span>
    </div>
  `
    )
    .join("")
  return `
    <div class="course-overview" aria-busy="true">
      <div class="overview-main">
        <section class="overview-card overview-description">
          <h2 class="overview-card-title">课程简介</h2>
          <div class="skeleton-item skeleton-line"></div>
          <div class="skeleton-item skeleton-line"></div>
          <div class="skeleton-item skeleton-line"></div>
          <div class="skeleton-item skeleton-line short"></div>
        </section>
        ${renderActivityCard("pending", "待完成")}
        ${renderActivityCard("recent", "最近更新")}
      </div>
      <aside class="overview-aside">
        <section class="overview-card">
          <h2 class="overview-card-title">课程信息</h2>
          <div class="overview-facts">${facts}</div>
        </section>
        <section class="overview-card">
          <h2 class="overview-card-title">授课教师</h2>
          <div class="overview-teacher">
            <div class="skeleton-item skeleton-avatar"></div>
            <span class="skeleton-item skeleton-name"></span>
          </div>
        </section>
      </aside>
    </div>
  `
}

async function fetchCourseData(courseId: string): Promise<CourseData | null> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/courses/${courseId}`
    )
    if (!response.ok) {
      console.error("XZZDPRO: 获取课程数据失败", response.status)
      return null
    }
    return await response.json()
  } catch (error) {
    console.error("XZZDPRO: 获取课程数据时出错", error)
    return null
  }
}

/** Course name for the page heading. */
export function getCourseTitle(data: CourseData): string {
  return data.display_name || data.name || "课程概览"
}

/** Short context line under the heading, e.g. "本科生院 · 2025-2026春". */
export function getCourseSubtitle(data: CourseData): string {
  return [data.department?.name, data.semester?.name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ")
}

/**
 * Teacher-authored descriptions arrive either as rich HTML or as plain text with
 * line breaks. HTML is sanitized; plain text is escaped and split into paragraphs.
 */
function renderRichText(content: string): string {
  if (/<[a-z][\s\S]*>/i.test(content)) return sanitizeHtml(content)
  return content
    .split(/\n\s*\n|\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("")
}

function renderFacts(data: CourseData): string {
  const studentCount = data.course_attributes?.student_count
  // The course name is the page heading, so it is not repeated here; empty fields are left out.
  const facts: Array<[string, string | undefined]> = [
    ["课程代码", data.course_code],
    ["开课院系", data.department?.name],
    ["上课学期", data.semester?.name],
    ["开始日期", data.start_date ?? undefined],
    ["授课班级", data.course_attributes?.teaching_class_name],
    [
      "选课人数",
      typeof studentCount === "number" ? `${studentCount} 人` : undefined
    ]
  ]
  const rows = facts
    .filter(([, value]) => value && value.trim())
    .map(
      ([label, value]) => `
      <div class="overview-fact">
        <dt>${label}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>
    `
    )
    .join("")
  return rows
    ? `<dl class="overview-facts">${rows}</dl>`
    : '<p class="overview-empty">暂无课程信息</p>'
}

function renderInstructor(instructor: Instructor): string {
  const name = instructor.name?.trim() || "未知教师"
  const avatarUrl = instructor.avatar_big_url || instructor.avatar_small_url
  // The initial sits underneath; a loaded photo covers it, a failed one is removed.
  const avatar = `
    <span class="overview-avatar" aria-hidden="true">
      <span>${escapeHtml(Array.from(name)[0])}</span>
      ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
    </span>
  `
  const email = instructor.email?.trim()
  return `
    <li class="overview-teacher">
      ${avatar}
      <span class="overview-teacher-text">
        <span class="overview-teacher-name">${escapeHtml(name)}</span>
        ${email ? `<a class="overview-teacher-email" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : ""}
      </span>
    </li>
  `
}

function renderInstructors(data: CourseData): string {
  const instructors =
    data.instructors?.filter((instructor) => instructor?.name) || []
  return instructors.length
    ? `<ul class="overview-teachers">${instructors.map(renderInstructor).join("")}</ul>`
    : '<p class="overview-empty">暂无教师信息</p>'
}

function renderDescription(data: CourseData): string {
  const fields = data.course_outline?.common_fields || []
  const chinese = fields
    .find((f) => f.key === "comment_chinese")
    ?.description?.trim()
  const english = fields
    .find((f) => f.key === "comment_english")
    ?.description?.trim()

  if (!chinese && !english) {
    return '<p class="overview-empty">暂未填写课程简介</p>'
  }
  return `
    ${chinese ? `<div class="overview-prose">${renderRichText(chinese)}</div>` : ""}
    ${
      english
        ? `
      <div class="overview-english" lang="en">
        ${chinese ? '<h3 class="overview-subtitle">English</h3>' : ""}
        <div class="overview-prose">${renderRichText(english)}</div>
      </div>
    `
        : ""
    }
  `
}

function renderListSkeleton(): string {
  return Array(3)
    .fill("")
    .map(
      () => `
    <div class="overview-row">
      <span class="overview-row-main">
        <span class="skeleton-item skeleton-value"></span>
        <span class="skeleton-item skeleton-label"></span>
      </span>
    </div>
  `
    )
    .join("")
}

/** Card whose body is filled once its own request returns; a link is added when known. */
function renderActivityCard(
  kind: "pending" | "recent",
  title: string,
  link?: { href: string; text: string }
): string {
  return `
    <section class="overview-card" id="overview-${kind}">
      <div class="overview-card-head">
        <h2 class="overview-card-title">${title}</h2>
        ${link ? `<a class="overview-card-link" href="${escapeHtml(link.href)}">${link.text}</a>` : ""}
      </div>
      <div class="overview-card-body" aria-busy="true">${renderListSkeleton()}</div>
    </section>
  `
}

export function renderPendingBody(items: PendingItem[] | null): string {
  if (!items)
    return '<p class="overview-empty">待完成事项加载失败，请刷新页面重试</p>'
  if (!items.length) return '<p class="overview-empty">这门课暂无待完成事项</p>'
  const rows = items
    .slice(0, PENDING_LIMIT)
    .map((item) => {
      const deadline = getDeadlineInfo(item.daysLeft)
      const meta = [
        item.typeName,
        item.deadlineText ? `截止 ${item.deadlineText}` : "无截止时间"
      ].join(" · ")
      return `
      <li class="overview-row">
        <a class="overview-row-main" href="${escapeHtml(item.link)}">
          <span class="overview-row-title">${escapeHtml(item.title)}</span>
          <span class="overview-row-meta">${escapeHtml(meta)}</span>
        </a>
        ${deadline ? `<span class="${badgeVariants({ variant: deadline.variant })} overview-row-badge">${escapeHtml(deadline.text)}</span>` : ""}
      </li>
    `
    })
    .join("")
  const hidden = items.length - PENDING_LIMIT
  return `
    <ul class="overview-list">${rows}</ul>
    ${hidden > 0 ? `<p class="overview-more">另有 ${hidden} 项未显示，可在首页待办中查看</p>` : ""}
  `
}

export function renderRecentBody(
  items: RecentUpload[] | null,
  now = new Date()
): string {
  if (!items)
    return '<p class="overview-empty">课件加载失败，请刷新页面重试</p>'
  if (!items.length) return '<p class="overview-empty">这门课暂未发布课件</p>'
  const rows = items
    .map((item) => {
      const meta = [
        item.activityTitle,
        item.time ? formatRelativeDay(item.time, now) : ""
      ]
        .filter(Boolean)
        .join(" · ")
      return `
      <li class="overview-row">
        <a class="overview-row-main" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">
          <span class="overview-row-title">${escapeHtml(item.name)}</span>
          ${meta ? `<span class="overview-row-meta">${escapeHtml(meta)}</span>` : ""}
        </a>
      </li>
    `
    })
    .join("")
  return `<ul class="overview-list">${rows}</ul>`
}

export function renderOverviewContent(
  data: CourseData | null,
  courseId: string | number = data?.id ?? ""
): string {
  if (!data) {
    return `<p class="error-message">无法加载课程信息，请刷新页面重试</p>`
  }
  const coursewareHref = `https://courses.zju.edu.cn/course/${encodeURIComponent(String(courseId))}/courseware#/`

  return `
    <div class="course-overview">
      <div class="overview-main">
        <section class="overview-card overview-description">
          <h2 class="overview-card-title">课程简介</h2>
          ${renderDescription(data)}
        </section>
        ${renderActivityCard("pending", "待完成")}
        ${renderActivityCard("recent", "最近更新", { href: coursewareHref, text: "全部课件" })}
      </div>
      <aside class="overview-aside">
        <section class="overview-card">
          <h2 class="overview-card-title">课程信息</h2>
          ${renderFacts(data)}
        </section>
        <section class="overview-card">
          <h2 class="overview-card-title">授课教师</h2>
          ${renderInstructors(data)}
        </section>
      </aside>
    </div>
  `
}

export async function courseOverviewBeautifier(): Promise<void> {
  console.log("XZZDPRO: 准备接管课程概览页...")

  // The breadcrumb ends at "课程概览"; the course name becomes the page heading once loaded.
  const page = await mountCourseDetailPage({
    currentPage: "overview",
    pageTitle: "课程概览",
    courseName: "课程概览",
    contentHtml: renderOverviewLoading()
  })
  if (!page) return
  const { courseId, root, contentSection } = page

  // Start all requests together; the activity cards are filled only after the
  // course content (which contains them) has been rendered.
  const todosRequest = fetchTodos()
  const coursewareRequest = fetchCoursewares(courseId)
  const courseData = await fetchCourseData(courseId)

  if (courseData) {
    const heading = root.querySelector(".course-detail-heading h1")
    if (heading) heading.textContent = getCourseTitle(courseData)
    const subtitle = root.querySelector(".course-detail-heading p")
    const subtitleText = getCourseSubtitle(courseData)
    if (subtitle && subtitleText) subtitle.textContent = subtitleText
    else subtitle?.remove()
  }

  if (contentSection) {
    contentSection.innerHTML = renderOverviewContent(courseData, courseId)
  }
  if (!courseData) return

  const fill = (kind: "pending" | "recent", html: string) => {
    const body = root.querySelector(`#overview-${kind} .overview-card-body`)
    if (!body) return
    body.innerHTML = html
    body.removeAttribute("aria-busy")
  }
  await Promise.all([
    todosRequest.then((todos) =>
      fill(
        "pending",
        renderPendingBody(todos && pendingForCourse(todos, courseId))
      )
    ),
    coursewareRequest.then((activities) =>
      fill(
        "recent",
        renderRecentBody(activities && recentUploads(activities, courseId))
      )
    )
  ])

  console.log("XZZDPRO: 课程概览页面渲染完成")
}
