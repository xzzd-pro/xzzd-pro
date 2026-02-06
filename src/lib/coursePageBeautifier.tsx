// lib/coursePageBeautifier

import * as React from "react"
import { createRoot, type Root } from "react-dom/client"
import {
  renderHeader,
  renderSidebar,
  setupThemeToggle,
  setupHelpModal,
  setupSidebarToggle,
  setupAssistantNavigation,
  setupAvatarUpload,
} from "./components/layoutHelpers"
import { CoursePage } from "@/components/course/CoursePage"
import type { ApiCourseData } from "../types"

const $ = (selector: string): HTMLElement | null =>
  document.querySelector(selector)
const $$ = (selector: string): NodeListOf<HTMLElement> =>
  document.querySelectorAll(selector)

interface CourseFilters {
  semester_id?: string[]
  status?: string[]
  keyword?: string
  classify_type?: string
}

// React root for course page
let coursePageRoot: Root | null = null

/* get courses api */
async function fetchCoursesFromApi(
  filters: CourseFilters = {}
): Promise<ApiCourseData[]> {
  try {
    const payload = {
      conditions: {
        semester_id: filters.semester_id || [],
        status: filters.status || ["ongoing", "notStarted", "closed"],
        keyword: filters.keyword || "",
        classify_type: filters.classify_type || "recently_started",
        display_studio_list: false,
      },
      showScorePassedStatus: false,
    }

    const response = await fetch("https://courses.zju.edu.cn/api/my-courses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error("XZZDPRO: 课程API请求失败", response.status)
      return []
    }

    const data = await response.json()

    if (data.courses && Array.isArray(data.courses)) {
      return data.courses
    }

    console.warn("XZZDPRO: 未找到预期的课程数据结构", data)
    return []
  } catch (error) {
    console.error("XZZDPRO: 课程网络请求出错", error)
    return []
  }
}

// Render course page using React
function renderCoursePageReact(
  container: HTMLElement,
  courses: ApiCourseData[],
  loading: boolean = false,
  onSearch: (filters: { keyword: string; status: string[] }) => void
) {
  if (!coursePageRoot) {
    coursePageRoot = createRoot(container)
  }
  coursePageRoot.render(
    <CoursePage courses={courses} loading={loading} onSearch={onSearch} />
  )
}

async function loadAndRenderCourses(filters: CourseFilters = {}) {
  const container = $(".course-page-container")
  if (!container) return

  const handleSearch = (searchFilters: { keyword: string; status: string[] }) => {
    const courseFilters: CourseFilters = {
      keyword: searchFilters.keyword,
      status: searchFilters.status.length > 0 ? searchFilters.status : ["ongoing", "notStarted", "closed"],
    }
    loadAndRenderCourses(courseFilters)
  }

  // Show loading state
  renderCoursePageReact(container, [], true, handleSearch)

  let courses: ApiCourseData[] = []
  try {
    courses = await fetchCoursesFromApi(filters)
  } catch (e) {
    console.warn("XZZDPRO: 获取课程异常", e)
  }

  renderCoursePageReact(container, courses, false, handleSearch)
}

function setupSearchHandler() {
  // Search handler is now integrated into the React component
  // No additional setup needed
}

export function coursePageBeautifier(): void {
  console.log("XZZDPRO: 准备接管课程页...")

  const usernameElement = $("#userCurrentName")
  const username = usernameElement?.textContent?.trim() ?? ""

  // 移除 chatbot 并监视动态添加
  const removeChatbot = () => {
    document.querySelectorAll("air-chatbot-app").forEach((el) => el.remove())
  }
  removeChatbot()

  const observer = new MutationObserver(() => {
    removeChatbot()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  // 5秒后停止监视
  setTimeout(() => observer.disconnect(), 5000)

  document.body.innerHTML = ""
  const root = document.createElement("div")
  root.className = "xzzdpro-root"

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
  document.body.classList.add("xzzdpro-body")

  setupThemeToggle()
  setupHelpModal()
  setupAvatarUpload()
  setupAssistantNavigation()
  setupSidebarToggle()
  setupSearchHandler()

  console.log("XZZDPRO: 页面骨架渲染完成，开始异步加载数据...")

  loadAndRenderCourses()
}
