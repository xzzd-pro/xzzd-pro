import * as React from "react"
import { createRoot, type Root } from "react-dom/client"

import { setupAssistantNavigation } from "@/assistant/sidebar/navigation"
import { CoursePage } from "@/features/courses/components/course-page"
import { describeLoadError, LoadError } from "@/shared/api/load-error"
import {
  createMyCoursesPayload,
  fetchMyCoursesResponse
} from "@/shared/api/my-courses-api"
import { suppressAirChatbot } from "@/shared/content-scripts/page-lifecycle"
import {
  renderHeader,
  renderSidebar,
  setupAvatarUpload,
  setupHelpModal,
  setupSidebarToggle,
  setupThemeToggle
} from "@/shared/layout"
import type { ApiCourseData } from "@/types"

import type { CourseFilters } from "./course-filters"

const queryElement = (selector: string): HTMLElement | null =>
  document.querySelector(selector)

// React root for course page
let coursePageRoot: Root | null = null
let coursePageContainer: HTMLElement | null = null
let coursesRequestId = 0

/**
 * Fetches the user's course list.
 * @param filters Conditions to send to the API.
 * @returns The courses; empty if the response has none.
 * @throws LoadError on an HTTP error, or the fetch error if the request fails.
 */
async function fetchCoursesFromApi(
  filters: Partial<CourseFilters> = {}
): Promise<ApiCourseData[]> {
  const payload = createMyCoursesPayload({
    semester_id: filters.semester_id || [],
    status: filters.status || ["ongoing", "notStarted", "closed"],
    keyword: filters.keyword || "",
    classify_type: "recently_started",
    display_studio_list: false
  })

  const response = await fetchMyCoursesResponse(payload)
  if (!response.ok) {
    throw new LoadError("课程请求失败", response.status)
  }

  const data = await response.json()
  if (Array.isArray(data.courses)) return data.courses

  console.warn("XZZDPRO: 未找到预期的课程数据结构", data)
  return []
}

function renderCoursePageReact(
  container: HTMLElement,
  courses: ApiCourseData[],
  loading: boolean = false,
  error: string | null = null
) {
  if (coursePageContainer !== container) {
    coursePageRoot?.unmount()
    coursePageRoot = null
    coursePageContainer = container
  }
  if (!coursePageRoot) {
    coursePageRoot = createRoot(container)
  }
  coursePageRoot.render(
    <CoursePage
      courses={courses}
      loading={loading}
      error={error}
      onRetry={() => void loadAndRenderCourses()}
    />
  )
}

async function loadAndRenderCourses(filters: Partial<CourseFilters> = {}) {
  const container = queryElement(".course-page-container")
  if (!container) return
  const requestId = ++coursesRequestId

  renderCoursePageReact(container, [], true)

  let courses: ApiCourseData[] = []
  let error: string | null = null
  try {
    courses = await fetchCoursesFromApi(filters)
  } catch (e) {
    console.warn("XZZDPRO: 获取课程异常", e)
    error = describeLoadError(e, "课程")
  }

  if (
    requestId !== coursesRequestId ||
    !container.isConnected ||
    container !== coursePageContainer ||
    container !== queryElement(".course-page-container")
  )
    return

  renderCoursePageReact(container, courses, false, error)
}

/**
 * Replaces the course list page with the extension layout and the filterable course grid.
 */
export function coursePageBeautifier(): void {
  console.log("XZZDPRO: 准备接管课程页...")

  const usernameElement = queryElement("#userCurrentName")
  const username = usernameElement?.textContent?.trim() ?? ""

  suppressAirChatbot()

  document.body.innerHTML = ""
  const root = document.createElement("div")
  root.className = "xzzdpro-root xzzdpro"

  root.innerHTML = `
    ${renderHeader({ username, showUsername: true })}

    ${renderSidebar({ currentPage: "courses" })}

    <main class="xzzdpro-main" id="main-grid">
      <div class="resize-handle resize-handle-left"></div>
      <div class="main-content-wrapper">
        <div class="course-page-container"></div>
      </div>
      <div class="resize-handle resize-handle-right"></div>
    </main>
  `

  document.body.appendChild(root)
  document.body.classList.add("xzzdpro-body", "xzzdpro")

  setupThemeToggle()
  setupHelpModal()
  setupAvatarUpload()
  setupAssistantNavigation()
  setupSidebarToggle()

  console.log("XZZDPRO: 页面骨架渲染完成，开始异步加载数据...")

  loadAndRenderCourses()
}
