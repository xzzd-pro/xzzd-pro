// lib/indexPageBeautifier

import { Storage } from "@plasmohq/storage"
import { sendToBackground } from "@plasmohq/messaging";
import {
  renderHeader,
  renderSidebar,
  setupThemeToggle,
  setupHelpModal,
  setupSidebarToggle,
} from "./components/layoutHelpers";
import { setupResizeHandlers, applySavedLayout } from "./components/resizeHandlers";

import type {
  ApiTodoData,
  ProcessedTodo,
  ApiCourseData,
  ProcessedCourse,
} from "../types";
const $ = (selector: string): HTMLElement | null => document.querySelector(selector);
const $$ = (selector: string): NodeListOf<HTMLElement> => document.querySelectorAll(selector);

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function generateActivityUrl(item: ApiTodoData): string {
  if (!item.course_id || !item.id) {
    return '#';
  }
  // Exam type uses different URL format
  if (item.type === 'exam') {
    return `https://courses.zju.edu.cn/course/${item.course_id}/learning-activity#/exam/${item.id}`;
  }
  return `https://courses.zju.edu.cn/course/${item.course_id}/learning-activity#/${item.id}`;
}

/* get todolist api */
async function fetchTodosFromApi(): Promise<ApiTodoData[]> {
  try {
    const response = await fetch('/api/todos?no-intercept=true');

    if (!response.ok) {
      console.error('XZZDPRO: API 请求失败', response.status);
      return [];
    }

    const data = await response.json();

    if (data.todo_list && Array.isArray(data.todo_list)) {
      return data.todo_list;
    }

    if (Array.isArray(data)) return data;

    console.warn('XZZDPRO: 未找到预期的数据结构', data);
    return [];
  } catch (error) {
    console.error('XZZDPRO: 网络请求出错', error);
    return [];
  }
}

/* get courses api */
async function fetchCoursesFromApi(): Promise<ApiCourseData[]> {
  try {
    const payload = {
        "conditions": {
          "semester_id": [
            "78"
          ],
          "status": [
            "ongoing",
            "notStarted",
            "closed"
          ],
          "keyword": "",
          "classify_type": "recently_started",
          "display_studio_list": false
        },
        "showScorePassedStatus": false
    }

    const response = await fetch('https://courses.zju.edu.cn/api/my-courses', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(payload) 
    });

    if (!response.ok) {
      console.error('XZZDPRO: 课程API请求失败', response.status);
      return [];
    }

    const data = await response.json();

    if (data.courses && Array.isArray(data.courses)) {
      return data.courses;
    }

    console.warn('XZZDPRO: 未找到预期的课程数据结构', data);
    return [];
  } catch (error) {
    console.error('XZZDPRO: 课程网络请求出错', error);
    return [];
  }
}

function isCourseToday(teachingClassName: string, today: Date): boolean {
  if (!teachingClassName) return false;

  const weekdayMap: Record<number, string> = {
    0: '周日',
    1: '周一',
    2: '周二',
    3: '周三',
    4: '周四',
    5: '周五',
    6: '周六'
  };

  const todayWeekday = weekdayMap[today.getDay()];
  return teachingClassName.includes(todayWeekday);
}

function getLoadingHtml(text: string = '加载中...'): string {
  return `
    <div class="xzzd-loading-state" style="padding: 20px; text-align: center; color: #888;">
      <span class="spinner">Checking...${text}</span> 
    </div>
  `;
}

// State for login flow
let loginWindow: Window | null = null;
let pollingInterval: NodeJS.Timeout | null = null;

function generateCourseUrl(item: ApiCourseData): string {
  if (!item.id) {
    return '#';
  }
  return `https://courses.zju.edu.cn/course/${item.id}/content#/`;
}

async function loadAndRenderCourses(studentId: string) {
  console.log("XZZDPRO: Starting course data fetch...");

  // Parallel fetch: Background (ZDBK) and API (Courses)
  const [response, apiCourses] = await Promise.all([
    sendToBackground({
      name: "get-courses",
      body: { studentId },
    } as any),
    fetchCoursesFromApi().catch((e) => {
      console.warn("XZZDPRO: Failed to fetch API courses", e);
      return [] as ApiCourseData[];
    }),
  ]);

  console.log("XZZDPRO: Received response from background:", response);
  const container = $(".today-courses-card .courses-list-container");

  if (!container) {
    console.error("XZZDPRO: Could not find courses container!");
    return;
  }

  if (response && response.status === "ok" && response.data) {
    // Login successful: Clean up polling and window
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    if (loginWindow && !loginWindow.closed) {
      loginWindow.close();
      loginWindow = null;
    }

    const kbList = response.data.kbList || [];
    const today = new Date();
    // ZDBK uses 1=Monday, 7=Sunday. JS uses 0=Sunday, 1=Monday.
    const currentDay = today.getDay() || 7;
    const dateStr = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;

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
    };

    // Helper to parse kcb string
    // Format: "CourseName<br>Term{Weeks|Freq}<br>Teacher<br>Location'zwf'Examtime..."
    // Example: "面向对象程序设计<br>秋冬{第1-8周|1节/周}<br>张明雪<br>紫金港西2-213zwf2026年01月16日(08:00-10:00)zwf"
    const parseKcb = (kcbStr: string) => {
      if (!kcbStr) return { name: "未知课程", teacher: "", location: "" };
      const parts = kcbStr.split("<br>");
      const name = parts[0] || "未知课程";
      const teacher = parts[2] || "";
      let location = parts[3].split("zwf")[0] || "";
      return { name, teacher, location };
    };

    // Filter courses for today
    let rawCourses = kbList
      .filter((course: any) => {
        return course.xqj == currentDay;
      })
      .map((course: any) => {
        const details = parseKcb(course.kcb);
        const startPeriod = parseInt(course.djj);
        const duration = parseInt(course.skcd);
        const endPeriod = startPeriod + duration - 1;

        let link = "#";
        if (apiCourses && Array.isArray(apiCourses)) {
          const normalize = (str: string) =>
            str ? str.replace(/[（）()_\-\s]/g, "").toLowerCase() : "";
          const zdbkName = normalize(details.name);

          const matched = apiCourses.find((c) => {
            const apiName = normalize(c.name);
            const apiDisplayName = normalize(c.display_name);

            if (!zdbkName) return false;

            const nameMatch =
              apiName &&
              (zdbkName.includes(apiName) || apiName.includes(zdbkName));
            const displayMatch =
              apiDisplayName &&
              (zdbkName.includes(apiDisplayName) ||
                apiDisplayName.includes(zdbkName));

            return nameMatch || displayMatch;
          });

          if (matched) {
            link = generateCourseUrl(matched);
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
        };
      })
      .sort((a: any, b: any) => {
        return a.startPeriod - b.startPeriod;
      });

    // Merge consecutive courses (e.g. 6and 7-8)
    const mergedCourses: any[] = [];
    if (rawCourses.length > 0) {
      let current = rawCourses[0];
      for (let i = 1; i < rawCourses.length; i++) {
        const next = rawCourses[i];
        // Check if same course (name & location) and consecutive periods
        if (
          current.parsedName === next.parsedName &&
          current.parsedLocation === next.parsedLocation &&
          current.endPeriod + 1 === next.startPeriod
        ) {
          // Merge: extend the end period
          current.endPeriod = next.endPeriod;
        } else {
          mergedCourses.push(current);
          current = next;
        }
      }
      mergedCourses.push(current);
    }

    // Format for display
    const todayCourses = mergedCourses.map((course: any) => {
      const startPeriod = course.startPeriod;
      const endPeriod = course.endPeriod;
      const periodStr =
        startPeriod === endPeriod
          ? `${startPeriod}`
          : `${startPeriod}-${endPeriod}`;

      // Calculate time range
      let timeRange = "";
      if (periodTimeMap[startPeriod] && periodTimeMap[endPeriod]) {
        const startTime = periodTimeMap[startPeriod].split("-")[0];
        const endTime = periodTimeMap[endPeriod].split("-")[1];
        timeRange = `${startTime}-${endTime}`;
      } else {
        timeRange = "时间未知";
      }

      return {
        ...course,
        periodStr,
        timeRange,
      };
    });

    if (container) {
      if (todayCourses.length > 0) {
        console.log(`XZZDPRO: Rendering ${todayCourses.length} courses`);
        const coursesHtml = todayCourses
          .map((course: any) => {
            const itemContent = `
                  <div class="todo-item-header">
                      <span class="todo-title">${course.parsedName}</span>
                      <span class="todo-type-badge">${course.periodStr}节 (${course.timeRange})</span>
                  </div>
                  <div class="todo-item-footer">
                      <span class="todo-deadline">地点： ${course.parsedLocation || "未知地点"} | 老师： ${course.parsedTeacher}</span>
                  </div>
              `;

            if (course.link && course.link !== "#") {
              return `<a href="${course.link}" target="_blank" class="todo-item todo-item-link" style="text-decoration: none; color: inherit; display: block;">${itemContent}</a>`;
            } else {
              return `<div class="todo-item">${itemContent}</div>`;
            }
          })
          .join("");

        container.innerHTML = coursesHtml;
      } else {
        container.innerHTML = `<p class="no-todos-message">今天没有课哦 ~</p>`;
      }
    }
  } else if (response && response.status === "login_required") {
    // Try to auto-open login page (might be blocked by popup blocker)
    if (!loginWindow || loginWindow.closed) {
      loginWindow = window.open(
        "https://zdbk.zju.edu.cn/jwglxt/xtgl/login_slogin.html",
        "_blank"
      );
    }

    // Start polling if not already polling
    if (!pollingInterval) {
      pollingInterval = setInterval(() => {
        console.log("XZZDPRO: Polling for login status...");
        loadAndRenderCourses(studentId);
      }, 2000);
    }

    // Debug: if cannot auto login, show login prompt
    if (container) {
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
          `;

      // Add click handler for the button
      const btn = container.querySelector("#login-btn");
      if (btn) {
        (btn as HTMLElement).onclick = () => {
          if (!loginWindow || loginWindow.closed) {
            loginWindow = window.open(
              "https://zdbk.zju.edu.cn/jwglxt/xtgl/login_slogin.html",
              "_blank"
            );
          }
        };
      }
    }
  } else {
    console.error("XZZDPRO: Error fetching courses or no data:", response);
    if (container) {
      container.innerHTML = `
          <p>无法获取课程数据。</p>
          <pre style="font-size:10px;overflow:auto;max-height:100px">${JSON.stringify(response, null, 2)}</pre>
          `;
    }
  }
}

async function loadAndRenderTodos() {
  const container = $('.todo-list-container');
  if (!container) return;

  let rawTodos: ApiTodoData[] = [];
  try {
    rawTodos = await fetchTodosFromApi();
  } catch (e) {
    console.warn('XZZDPRO: 获取待办异常', e);
  }

  const today = new Date();
  
  // data processing
  const todos: ProcessedTodo[] = rawTodos.map(item => {
    const title = item.title || '未知任务';
    const typeMap: Record<string, string> = { 'homework': '作业', 'exam': '考试', 'evaluation': '评教', 'questionnaire': '问卷', 'vote': '投票' };
    const typeName = typeMap[item.type] || item.type;
    const courseName = item.course_name || '';
    const linkUrl = generateActivityUrl(item);

    let daysLeft: number | null = null;
    let deadlineText = '无截止日期';
    if (item.end_time) {
      const deadlineDate = new Date(item.end_time);
      if (!isNaN(deadlineDate.getTime())) {
        deadlineText = formatDate(deadlineDate);
        const diffTime = deadlineDate.getTime() - today.getTime();
        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }
    return { title, type: typeName, courseName, deadline: deadlineText, daysLeft, link: linkUrl };
  }).sort((a, b) => {
    if (a.daysLeft === null && b.daysLeft === null) return 0;
    if (a.daysLeft === null) return 1;
    if (b.daysLeft === null) return -1;
    return a.daysLeft - b.daysLeft;
  });

  // HTML
  const todoListHtml = todos.length > 0
    ? todos.map(todo => {
        let daysLeftClass = '';
        let daysLeftText = '';
        if (todo.daysLeft !== null) {
          if (todo.daysLeft <= 0) { daysLeftClass = 'days-left-overdue'; daysLeftText = '已过期'; }
          else if (todo.daysLeft <= 3) { daysLeftClass = 'days-left-urgent'; daysLeftText = `剩余 ${todo.daysLeft} 天`; }
          else if (todo.daysLeft <= 7) { daysLeftClass = 'days-left-soon'; daysLeftText = `剩余 ${todo.daysLeft} 天`; }
          else { daysLeftClass = 'days-left-normal'; daysLeftText = `剩余 ${todo.daysLeft} 天`; }
        }

        const itemContent = `
          ${todo.courseName ? `<div class="todo-course-name">${todo.courseName}</div>` : ''}
          <div class="todo-item-header">
            <span class="todo-title">${todo.title}</span>
            ${todo.type ? `<span class="todo-type-badge">${todo.type}</span>` : ''}
          </div>
          <div class="todo-item-footer">
            <span class="todo-deadline">${todo.deadline}</span>
            ${daysLeftText ? `<span class="todo-days-left ${daysLeftClass}">${daysLeftText}</span>` : ''}
          </div>
        `;
        return todo.link
          ? `<a href="${todo.link}" class="todo-item todo-item-link">${itemContent}</a>`
          : `<div class="todo-item">${itemContent}</div>`;
      }).join('')
    : `<p class="no-todos-message"><span>太棒了，没有待办事项！</span></p>`;

  container.innerHTML = todoListHtml;
}

// main function
export async function indexPageBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管主页...');

  const usernameElement = $('#userCurrentName');
  const username = usernameElement ? usernameElement.textContent.trim() : '同学';

  // Get student ID from .user-no
  const userNoElement = $('.user-no');
  const studentId = userNoElement ? userNoElement.textContent.trim() : '';
  console.log('XZZDPRO: Found student ID:', studentId);

  // 移除 chatbot 并监视动态添加
  const removeChatbot = () => {
    document.querySelectorAll('air-chatbot-app').forEach(el => el.remove());
  };
  removeChatbot();

  const observer = new MutationObserver(() => {
    removeChatbot();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 5秒后停止监视
  setTimeout(() => observer.disconnect(), 5000);

  const today = new Date();
  const todayDate = formatDate(today);

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root';

  root.innerHTML = `
    ${renderHeader({ username, showUsername: true })}

    ${renderSidebar({ currentPage: 'home' })}

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
          <div class="courses-list-container">
            ${getLoadingHtml('正在查询课表...')}
          </div>
        </div>
        <div class="resize-handle resize-handle-vertical" data-direction="vertical"></div>
        <div class="widget-card todo-card">
          <h2>待办事项</h2>
          <div class="todo-list-container">
            <!-- 这里先放加载动画 -->
            ${getLoadingHtml('正在同步DDL...')}
          </div>
        </div>
      </div>
      <div class="resize-handle resize-handle-right" data-direction="right"></div>
    </main>
  `;

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  console.log('XZZDPRO: 主页接管完成！');

  setupThemeToggle();
  setupHelpModal();

  console.log('XZZDPRO: 页面骨架渲染完成，开始异步加载数据...');

  loadAndRenderCourses(studentId);
  loadAndRenderTodos();

  // Apply saved layout state and setup resize handlers
  await applySavedLayout();
  setupResizeHandlers();
  console.log('XZZDPRO: 拖拽功能已初始化');
}
