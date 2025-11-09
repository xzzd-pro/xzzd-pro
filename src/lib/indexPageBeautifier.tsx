// lib/indexPageBeautifier

import { Storage } from "@plasmohq/storage"

const $ = (selector: string): HTMLElement | null => document.querySelector(selector);
const $$ = (selector: string): NodeListOf<HTMLElement> => document.querySelectorAll(selector);

// main function 
export function indexPageBeautifier(): void {
  console.log('XZZDPRO: 准备接管主页...');

  const usernameElement = $('#userCurrentName');
  const username = usernameElement ? usernameElement.textContent.trim() : 'None';
  const logoSrc = '';

  const todos = [];
  const todoElements = document.querySelectorAll('.todo-list-list .todo-list');

  todoElements.forEach(item => {
    // original selectors
    const titleEl = item.querySelector('[ng-bind="todoData.title"]');
    const typeEl = item.querySelector('.activity-type');
    const deadlineEl = item.querySelector('[ng-if="todoData.end_time"]');

    const title = titleEl ? titleEl.textContent.trim() : '未知标题';
    const type = typeEl ? typeEl.textContent.trim() : '';
    const deadline = deadlineEl ? deadlineEl.textContent.trim().replace('截止日期:', '') : '无截止日期';

    todos.push({ title, type, deadline });
  });

  const todoListHtml = todos.length > 0 
    ? todos.map(todo => `
        <div class="todo-item">
          <div class="todo-item-header">
            <span class="todo-title">${todo.title}</span>
            ${todo.type ? `<span class="todo-type-badge">${todo.type}</span>` : ''}
          </div>
          <div class="todo-item-footer">
            <span class="todo-deadline">${todo.deadline}</span>
          </div>
        </div>
      `).join('')
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
        <button id="theme-toggle-btn" class="icon-btn" title="切换主题">
          <span class="theme-icon">🌙</span>
        </button>
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
        <h3>今日课程 <span class="date">2025.10.24</span></h3>
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
-
  setupThemeToggle();
}

/*
theme toggle setup
*/
function setupThemeToggle(): void {
  const storage = new Storage();
  const themeToggleBtn = $('#theme-toggle-btn');
  const themeIcon = $('.theme-icon');

  if (!themeToggleBtn || !themeIcon) {
    console.warn('XZZDPRO: 主题切换按钮未找到');
    return;
  }

  const updateThemeIcon = (theme: string) => {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  };

  storage.get('theme').then((currentTheme) => {
    const theme = currentTheme || 'light';
    updateThemeIcon(theme);
  });

  storage.watch({
    theme: (change) => {
      updateThemeIcon(change.newValue || 'light');
    }
  });

  themeToggleBtn.addEventListener('click', async () => {
    const currentTheme = await storage.get('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    // storage
    await storage.set('theme', newTheme);
    updateThemeIcon(newTheme);

    console.log(`XZZDPRO: 主题已切换至 ${newTheme}`);
  });
}