// lib/indexPageBeautifier

import { Storage } from "@plasmohq/storage"
import { renderHeader, renderSidebar, setupThemeToggle } from "./components/layoutHelpers"
import { setupResizeHandlers, applySavedLayout } from "./resizeHandlers"

import type{
  ApiTodoData,
  ProcessedTodo,
  ApiCourseData,
  ProcessedCourse
} from "../types"

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

function generateCourseUrl(item: ApiCourseData): string {
  if (!item.id) {
    return '#';
  }
  return `https://courses.zju.edu.cn/course/${item.id}/content#/`;
}

async function loadAndRenderCourses() {
  const container = $('.courses-list-container');
  if (!container) return;

  let rawCourses: ApiCourseData[] = [];
  try {
    rawCourses = await fetchCoursesFromApi();
  } catch (e) {
    console.warn('XZZDPRO: 获取课程异常', e);
  }

  const today = new Date();
  
  // data processing
  const todayCourses: ProcessedCourse[] = rawCourses
    .filter(course => {
      const teachingClassName = course.course_attributes?.teaching_class_name || '';
      return isCourseToday(teachingClassName, today);
    })
    .map(course => ({
      name: course.display_name || course.name,
      instructors: course.instructors.map(i => i.name).join('、'),
      link: generateCourseUrl(course)
    }));

  // HTML
  const todayCoursesHtml = todayCourses.length > 0
    ? todayCourses.map(course => `
        <a href="${course.link}" class="course-item">
          <div class="course-name">${course.name}</div>
          <div class="course-instructor">任课老师：${course.instructors}</div>
        </a>
      `).join('')
    : `<p class="no-courses-message"><span>今天没有课程安排</span></p>`;

  container.innerHTML = todayCoursesHtml;
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

  setupThemeToggle();

  console.log('XZZDPRO: 页面骨架渲染完成，开始异步加载数据...');

  loadAndRenderCourses();
  loadAndRenderTodos();

  // Apply saved layout state and setup resize handlers
  await applySavedLayout();
  setupResizeHandlers();
  console.log('XZZDPRO: 拖拽功能已初始化');
}
