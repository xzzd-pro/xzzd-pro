// lib/indexPageBeautifier

import * as React from "react"
import { createRoot, type Root } from "react-dom/client"
import { sendToBackground } from "@plasmohq/messaging"
import {
  renderHeader,
  renderSidebar,
  setupThemeToggle,
  setupHelpModal,
  setupSidebarToggle,
  setupAssistantNavigation,
  setupAvatarUpload,
} from "./components/layoutHelpers"
import {
  setupResizeHandlers,
  applySavedLayout,
} from "./components/resizeHandlers"

import { TodayCoursesPanel, type TodayCourse } from "@/components/index/TodayCoursesPanel"
import { TodoPanel, type TodoItem } from "@/components/index/TodoPanel"

import type { ApiTodoData, ApiCourseData } from "../types"

const $ = (selector: string): HTMLElement | null =>
  document.querySelector(selector)

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}.${month}.${day}`
}

function generateActivityUrl(item: ApiTodoData): string {
  if (!item.course_id || !item.id) {
    return "#"
  }
  // Exam type uses different URL format
  if (item.type === "exam") {
    return `https://courses.zju.edu.cn/course/${item.course_id}/learning-activity#/exam/${item.id}`
  }
  return `https://courses.zju.edu.cn/course/${item.course_id}/learning-activity#/${item.id}`
}

/* get todolist api */
async function fetchTodosFromApi(): Promise<ApiTodoData[]> {
  try {
    const response = await fetch("/api/todos?no-intercept=true")

    if (!response.ok) {
      console.error("XZZDPRO: API 请求失败", response.status)
      return []
    }

    const data = await response.json()

    if (data.todo_list && Array.isArray(data.todo_list)) {
      return data.todo_list
    }

    if (Array.isArray(data)) return data

    console.warn("XZZDPRO: 未找到预期的数据结构", data)
    return []
  } catch (error) {
    console.error("XZZDPRO: 网络请求出错", error)
    return []
  }
}

/* get courses api */
async function fetchCoursesFromApi(): Promise<ApiCourseData[]> {
  try {
    const payload = {
      conditions: {
        semester_id: ["78"],
        status: ["ongoing", "notStarted", "closed"],
        keyword: "",
        classify_type: "recently_started",
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

// State for login flow
let loginWindow: Window | null = null
let pollingInterval: NodeJS.Timeout | null = null

// React roots for component mounting
let coursesRoot: Root | null = null
let todosRoot: Root | null = null

function generateCourseUrl(item: ApiCourseData): string {
  if (!item.id) {
    return "#"
  }
  return `https://courses.zju.edu.cn/course/${item.id}/content#/`
}

// Render courses using React
function renderCoursesReact(
  container: HTMLElement,
  courses: TodayCourse[],
  loading: boolean = false
) {
  if (!coursesRoot) {
    coursesRoot = createRoot(container)
  }
  coursesRoot.render(<TodayCoursesPanel courses={courses} loading={loading} />)
}

// Render login prompt (fallback HTML for login flow)
function renderLoginPrompt(container: HTMLElement, studentId: string) {
  container.innerHTML = `
    <div style="text-align: center; padding: 10px;">
      <p>需要登录教务系统</p>
      <button id="login-btn" class="login-btn" style="
        display: inline-block;
        background: #1890ff;
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        margin-top: 5px;
        font-size: 12px;
      ">去登录</button>
      <p style="font-size:10px;color:gray;margin-top:5px">登录成功后页面将自动刷新</p>
    </div>
  `

  const btn = container.querySelector("#login-btn")
  if (btn) {
    ;(btn as HTMLElement).onclick = () => {
      if (!loginWindow || loginWindow.closed) {
        loginWindow = window.open(
          "https://zdbk.zju.edu.cn/jwglxt/xtgl/login_slogin.html",
          "_blank"
        )
      }
    }
  }
}

async function loadAndRenderCourses(studentId: string) {
  console.log("XZZDPRO: Starting course data fetch...")

  const container = $(".today-courses-card .courses-list-container")
  if (!container) {
    console.error("XZZDPRO: Could not find courses container!")
    return
  }

  // Show loading state
  renderCoursesReact(container, [], true)

  // Parallel fetch: Background (ZDBK) and API (Courses)
  const [response, apiCourses] = await Promise.all([
    sendToBackground({
      name: "get-courses",
      body: { studentId },
    } as any),
    fetchCoursesFromApi().catch((e) => {
      console.warn("XZZDPRO: Failed to fetch API courses", e)
      return [] as ApiCourseData[]
    }),
  ])

  console.log("XZZDPRO: Received response from background:", response)

  if (response && response.status === "ok" && response.data) {
    // Login successful: Clean up polling and window
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
    if (loginWindow && !loginWindow.closed) {
      loginWindow.close()
      loginWindow = null
    }

    const kbList = response.data.kbList || []
    const today = new Date()
    // ZDBK uses 1=Monday, 7=Sunday. JS uses 0=Sunday, 1=Monday.
    const currentDay = today.getDay() || 7

    // Class to Time mapping
    const periodTimeMap: { [key: number]: string } = {
      1: "08:00-08:45",
      2: "08:50-09:35",
      3: "10:00-10:45",
      4: "10:50-11:35",
      5: "11:40-12:25",
      6: "13:25-14:05",
      7: "14:10-14:55",
      8: "15:15-15:50",
      9: "16:15-17:00",
      10: "17:05-17:50",
      11: "18:30-19:15",
      12: "19:20-20:05",
      13: "20:10-20:55",
    }

    // Helper to parse kcb string
    const parseKcb = (kcbStr: string) => {
      if (!kcbStr) return { name: "未知课程", teacher: "", location: "" }
      const parts = kcbStr.split("<br>")
      const name = parts[0] || "未知课程"
      const teacher = parts[2] || ""
      let location = parts[3]?.split("zwf")[0] || ""
      return { name, teacher, location }
    }

    // Filter courses for today
    let rawCourses = kbList
      .filter((course: any) => {
        return course.xqj == currentDay
      })
      .map((course: any) => {
        const details = parseKcb(course.kcb)
        const startPeriod = parseInt(course.djj)
        const duration = parseInt(course.skcd)
        const endPeriod = startPeriod + duration - 1

        let link = "#"
        if (apiCourses && Array.isArray(apiCourses)) {
          const normalize = (str: string) =>
            str ? str.replace(/[（）()_\-\s]/g, "").toLowerCase() : ""
          const zdbkName = normalize(details.name)

          const matched = apiCourses.find((c) => {
            const apiName = normalize(c.name)
            const apiDisplayName = normalize(c.display_name)

            if (!zdbkName) return false

            const nameMatch =
              apiName &&
              (zdbkName.includes(apiName) || apiName.includes(zdbkName))
            const displayMatch =
              apiDisplayName &&
              (zdbkName.includes(apiDisplayName) ||
                apiDisplayName.includes(zdbkName))

            return nameMatch || displayMatch
          })

          if (matched) {
            link = generateCourseUrl(matched)
          }
        }

        return {
          ...course,
          parsedName: details.name,
          parsedTeacher: details.teacher,
          parsedLocation: details.location,
          startPeriod: startPeriod,
          endPeriod: endPeriod,
          link: link,
        }
      })
      .sort((a: any, b: any) => {
        return a.startPeriod - b.startPeriod
      })

    // Merge consecutive courses
    const mergedCourses: any[] = []
    if (rawCourses.length > 0) {
      let current = rawCourses[0]
      for (let i = 1; i < rawCourses.length; i++) {
        const next = rawCourses[i]
        if (
          current.parsedName === next.parsedName &&
          current.parsedLocation === next.parsedLocation &&
          current.endPeriod + 1 === next.startPeriod
        ) {
          current.endPeriod = next.endPeriod
        } else {
          mergedCourses.push(current)
          current = next
        }
      }
      mergedCourses.push(current)
    }

    // Format for display
    const todayCourses: TodayCourse[] = mergedCourses.map((course: any) => {
      const startPeriod = course.startPeriod
      const endPeriod = course.endPeriod
      const periodStr =
        startPeriod === endPeriod
          ? `${startPeriod}`
          : `${startPeriod}-${endPeriod}`

      let timeRange = ""
      if (periodTimeMap[startPeriod] && periodTimeMap[endPeriod]) {
        const startTime = periodTimeMap[startPeriod].split("-")[0]
        const endTime = periodTimeMap[endPeriod].split("-")[1]
        timeRange = `${startTime}-${endTime}`
      } else {
        timeRange = "时间未知"
      }

      return {
        parsedName: course.parsedName,
        parsedTeacher: course.parsedTeacher,
        parsedLocation: course.parsedLocation,
        periodStr,
        timeRange,
        link: course.link,
      }
    })

    console.log(`XZZDPRO: Rendering ${todayCourses.length} courses`)
    renderCoursesReact(container, todayCourses, false)
  } else if (response && response.status === "login_required") {
    // Unmount React root if exists, then render login prompt
    if (coursesRoot) {
      coursesRoot.unmount()
      coursesRoot = null
    }

    // Try to auto-open login page
    if (!loginWindow || loginWindow.closed) {
      loginWindow = window.open(
        "https://zdbk.zju.edu.cn/jwglxt/xtgl/login_slogin.html",
        "_blank"
      )
    }

    // Start polling if not already polling
    if (!pollingInterval) {
      pollingInterval = setInterval(() => {
        console.log("XZZDPRO: Polling for login status...")
        loadAndRenderCourses(studentId)
      }, 2000)
    }

    renderLoginPrompt(container, studentId)
  } else {
    console.error("XZZDPRO: Error fetching courses or no data:", response)
    if (coursesRoot) {
      coursesRoot.unmount()
      coursesRoot = null
    }
    container.innerHTML = `
      <p>无法获取课程数据。</p>
      <pre style="font-size:10px;overflow:auto;max-height:100px">${JSON.stringify(response, null, 2)}</pre>
    `
  }
}

// Render todos using React
function renderTodosReact(
  container: HTMLElement,
  todos: TodoItem[],
  loading: boolean = false
) {
  if (!todosRoot) {
    todosRoot = createRoot(container)
  }
  todosRoot.render(<TodoPanel todos={todos} loading={loading} />)
}

async function loadAndRenderTodos() {
  const container = $(".todo-list-container")
  if (!container) return

  // Show loading state
  renderTodosReact(container, [], true)

  let rawTodos: ApiTodoData[] = []
  try {
    rawTodos = await fetchTodosFromApi()
  } catch (e) {
    console.warn("XZZDPRO: 获取待办异常", e)
  }

  const today = new Date()

  // Process todos
  const typeMap: Record<string, string> = {
    homework: "作业",
    exam: "考试",
    evaluation: "评教",
    questionnaire: "问卷",
    vote: "投票",
  }

  const todos: TodoItem[] = rawTodos
    .map((item) => {
      const title = item.title || "未知任务"
      const typeName = typeMap[item.type] || item.type
      const courseName = item.course_name || ""
      const linkUrl = generateActivityUrl(item)

      let daysLeft: number | null = null
      let deadlineText = "无截止日期"
      if (item.end_time) {
        const deadlineDate = new Date(item.end_time)
        if (!isNaN(deadlineDate.getTime())) {
          deadlineText = formatDate(deadlineDate)
          const diffTime = deadlineDate.getTime() - today.getTime()
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        }
      }
      return {
        title,
        type: typeName,
        courseName,
        deadline: deadlineText,
        daysLeft,
        link: linkUrl,
      }
    })
    .sort((a, b) => {
      if (a.daysLeft === null && b.daysLeft === null) return 0
      if (a.daysLeft === null) return 1
      if (b.daysLeft === null) return -1
      return a.daysLeft - b.daysLeft
    })

  renderTodosReact(container, todos, false)
}

// main function
export async function indexPageBeautifier(): Promise<void> {
  console.log("XZZDPRO: 准备接管主页...")

  const usernameElement = $("#userCurrentName")
  const username = usernameElement?.textContent?.trim() ?? ""

  // Get student ID from .user-no
  const userNoElement = $(".user-no")
  const studentId = userNoElement?.textContent?.trim() ?? ""
  console.log("XZZDPRO: Found student ID:", studentId)

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

  const today = new Date()
  const todayDate = formatDate(today)

  document.body.innerHTML = ""
  const root = document.createElement("div")
  root.className = "xzzdpro-root"

  root.innerHTML = `
    ${renderHeader({ username, showUsername: true })}

    ${renderSidebar({ currentPage: "home" })}

    <main class="xzzdpro-main" id="main-grid">
      <div class="resize-handle resize-handle-left" data-direction="left"></div>
      <div class="main-content-wrapper">
        <div class="widget-card welcome-card">
          <h2>欢迎回来</h2>
          <p>今天也要元气满满！</p>
        </div>
        <div class="resize-handle resize-handle-horizontal" data-direction="horizontal"></div>
        <div class="widget-card today-courses-card">
          <h2>今日课程 <span class="date">${todayDate}</span></h2>
          <div class="courses-list-container"></div>
        </div>
        <div class="resize-handle resize-handle-vertical" data-direction="vertical"></div>
        <div class="widget-card todo-card">
          <h2>待办事项</h2>
          <div class="todo-list-container"></div>
        </div>
      </div>
      <div class="resize-handle resize-handle-right" data-direction="right"></div>
    </main>
  `

  document.body.appendChild(root)
  document.body.classList.add("xzzdpro-body")

  console.log("XZZDPRO: 主页接管完成！")

  setupThemeToggle()
  setupHelpModal()
  setupAvatarUpload()
  setupAssistantNavigation()
  await setupSidebarToggle()

  console.log("XZZDPRO: 页面骨架渲染完成，开始异步加载数据...")

  loadAndRenderCourses(studentId)
  loadAndRenderTodos()

  // Apply saved layout state and setup resize handlers
  await applySavedLayout()
  setupResizeHandlers()
  console.log("XZZDPRO: 拖拽功能已初始化")
}
