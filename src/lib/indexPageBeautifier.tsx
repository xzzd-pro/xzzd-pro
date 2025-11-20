// lib/indexPageBeautifier

import { Storage } from "@plasmohq/storage"
import { createThemeToggle } from "./components/ThemeToggle"

// TypeScript 类型定义
interface ApiTodoData {
  $$hashKey?: string;
  course_code: string;
  course_id: number;
  course_name: string;
  course_type: number;
  end_time: string; 
  id: number;
  is_locked: boolean;
  is_student: boolean;
  order: string;
  prerequisites: any[];
  title: string;
  type: string; 
  url: string;
}

interface ProcessedTodo {
  title: string;
  type: string;
  courseName: string;
  deadline: string;
  daysLeft: number | null;
  link: string;
}

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

// main function
export async function indexPageBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管主页...');

  const usernameElement = $('#userCurrentName');
  const username = usernameElement ? usernameElement.textContent.trim() : 'None';
  const logoSrc = '';

  let rawTodos: ApiTodoData[] = [];
  try {
    rawTodos = await fetchTodosFromApi();
    console.log(`XZZDPRO: 成功获取 ${rawTodos.length} 条待办`);
  } catch (e) {
    console.warn('XZZDPRO: 获取数据流程异常', e);
  }

  const today = new Date();
  const todayDate = formatDate(today);

  const themeToggle = createThemeToggle();

  const todos: ProcessedTodo[] = rawTodos.map(item => {
    const title = item.title || '未知任务';

    const typeMap: Record<string, string> = {
      'homework': '作业',
      'exam': '考试',
      'evaluation': '评教',
      'questionnaire': '问卷',
      'vote': '投票'
    };
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
    return {
      title,
      type: typeName,
      courseName,
      deadline: deadlineText,
      daysLeft,
      link: linkUrl
    };
  }).sort((a, b) => {
    // 按截止日期排序，最近的排在前面
    // 没有截止日期的排在最后
    if (a.daysLeft === null && b.daysLeft === null) return 0;
    if (a.daysLeft === null) return 1;
    if (b.daysLeft === null) return -1;
    return a.daysLeft - b.daysLeft;
  });

  const todoListHtml = todos.length > 0
    ? todos.map(todo => {
        let daysLeftClass = '';
        let daysLeftText = '';

        if (todo.daysLeft !== null) {
          if (todo.daysLeft <= 0) {
            daysLeftClass = 'days-left-overdue';
            daysLeftText = '已过期';
          } else if (todo.daysLeft <= 3) {
            daysLeftClass = 'days-left-urgent';
            daysLeftText = `剩余 ${todo.daysLeft} 天`;
          } else if (todo.daysLeft <= 7) {
            daysLeftClass = 'days-left-soon';
            daysLeftText = `剩余 ${todo.daysLeft} 天`;
          } else {
            daysLeftClass = 'days-left-normal';
            daysLeftText = `剩余 ${todo.daysLeft} 天`;
          }
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

        if (todo.link) {
          return `
            <a href="${todo.link}" class="todo-item todo-item-link">
              ${itemContent}
            </a>
          `;
        } else {
          return `
            <div class="todo-item">
              ${itemContent}
            </div>
          `;
        }
      }).join('')
    : `<p class="no-todos-message">太棒了，没有待办事项！</p>`;

  // clear body
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root';

  // new structure
  root.innerHTML = `
    <header class="xzzdpro-header">
      <div class="logo-area">
        ${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : 'Logo 区域'}
      </div>
      <div class="right-section">
        ${themeToggle.renderHTML()}
        <span class="icon">🔔</span>
        <div class="user-profile">
          <span class="user-avatar"></span>
          <span class="username">${username}</span>
        </div>
      </div>
    </header>

    <nav class="xzzdpro-sidebar">
      <ul class="sidebar-nav">
        <li class="nav-item active">
          <a href="https://courses.zju.edu.cn/user/index#/" class="nav-link">
            <span class="nav-icon">🏠</span>
            <span class="nav-text">主页</span>
          </a>
        </li>
        <li class="nav-item">
          <a href="https://courses.zju.edu.cn/user/course#/" class="nav-link">
            <span class="nav-icon">📊</span>
            <span class="nav-text">课程</span>
          </a>
        </li>
        <li class="nav-item">
          <a href="#" class="nav-link">
            <span class="nav-icon">📢</span>
            <span class="nav-text">公告</span>
          </a>
        </li>
        <li class="nav-item">
          <a href="#" class="nav-link">
            <span class="nav-icon">🤖</span>
            <span class="nav-text">学习助理</span>
          </a>
        </li>
      </ul>
    </nav>

    <main class="xzzdpro-main">
      <div class="widget-card welcome-card">
        <h2>欢迎回来, ${username}</h2>
        <p>今天也要元气满满！</p>
      </div>
      <div class="widget-card today-courses-card">
        <h3>今日课程 <span class="date">${todayDate}</span></h3>
        <p>当天课程</p>
      </div>
      <div class="widget-card todo-card">
        <h3>待办事项</h3>
        <div class="todo-list-container">
          ${todoListHtml}
        </div>
      </div>
    </main>
  `;

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  console.log('XZZDPRO: 主页接管完成！');

  // 设置主题切换功能
  themeToggle.setup();
}
