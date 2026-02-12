// lib/components/layoutHelpers.ts - Shared layout components for header and sidebar

import { createThemeToggle } from "./ThemeToggle"
import { navIcons } from "./icons"
import { Storage } from "@plasmohq/storage"
import { createRoot } from "react-dom/client"
import React from "react"
import { AvatarUpload } from "../../components/ui/avatar-upload"

const storage = new Storage()
const LAYOUT_STORAGE_KEY = "indexPageLayout"

const LOGO_SRC = 'https://courses.zju.edu.cn/api/uploads/57/modified-image?thumbnail=0x272';

interface HeaderOptions {
  username?: string;
  showUsername?: boolean;
}

interface SidebarOptions {
  currentPage?: 'home' | 'notification' | 'courses' | 'assistant';
}

/**
 * Render the common header with logo, theme toggle, and user profile
 * @param options - Configuration options for the header
 * @returns HTML string for the header
 */
export function renderHeader(options: HeaderOptions = {}): string {
  const { username = '', showUsername = true } = options;
  const themeToggle = createThemeToggle();

  return `
    <header class="xzzdpro-header">
      <div class="logo-area">
        ${LOGO_SRC ? `<a href="https://courses.zju.edu.cn/user/index#/" class="logo-link"><img src="${LOGO_SRC}" alt="Logo"></a>` : '<a href="https://courses.zju.edu.cn/user/index#/" class="logo-link">Logo 区域</a>'}
        <button class="help-btn" id="help-btn" title="使用须知">
          <span>使用须知</span>
        </button>
      </div>
      <div class="right-section">
        ${themeToggle.renderHTML()}
        <div class="user-profile">
          <div id="user-avatar-container" class="user-avatar-container"></div>
          ${showUsername && username ? `<span class="username">${username}</span>` : ''}
        </div>
      </div>
    </header>

    <!-- 使用须知模态框 -->
    <div class="modal-overlay" id="help-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>使用须知</h3>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p><strong>欢迎使用 XZZDPRO 学在浙大美化插件！</strong></p>
          <ul>
            <li>本插件仅用于美化学在浙大页面，不会修改任何数据</li>
            <li>点击侧边栏底部的 &lt;&lt; 按钮可以收缩/展开侧边栏</li>
            <li>点击顶部的主题切换按钮可以切换明暗主题</li>
            <li>主页支持拖拽调整各区域大小</li>
            <li>布局设置会自动保存</li>
          </ul>
          <p><strong>如有问题或建议，欢迎反馈！</strong></p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the common sidebar navigation
 * @param options - Configuration options for the sidebar
 * @returns HTML string for the sidebar
 */
export function renderSidebar(options: SidebarOptions = {}): string {
  const { currentPage } = options;

  return `
    <nav class="xzzdpro-sidebar">
      <div class="sidebar-section">
        <ul class="sidebar-nav">
          <li class="nav-item ${currentPage === 'home' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/user/index#/" class="nav-link">
              <span class="nav-icon">${navIcons.home}</span>
              <span class="nav-text">主页</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'notification' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/bulletin-list/#/" class="nav-link">
              <span class="nav-icon">${navIcons.notification}</span>
              <span class="nav-text">动态</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'courses' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/user/courses#/" class="nav-link">
              <span class="nav-icon">${navIcons.courses}</span>
              <span class="nav-text">课程</span>
            </a>
          </li>
          <li class="nav-item nav-item-expandable ${currentPage === 'assistant' ? 'active' : ''}">
            <div class="nav-link nav-link-expandable">
              <a href="https://courses.zju.edu.cn/air" id="nav-assistant-link" class="nav-link-main" aria-label="学习助理">
                <span class="nav-icon">${navIcons.assistant}</span>
                <span class="nav-text">学习助理</span>
              </a>
              <button id="nav-assistant-expand" class="expand-toggle" type="button" aria-label="展开学习助理课程列表" title="展开课程列表">
                <span class="expand-arrow">▼</span>
              </button>
            </div>
            <div class="nav-submenu">
              <div id="assistant-course-list" class="course-list-submenu">
                <div class="submenu-loading">加载课程中...</div>
              </div>
            </div>
          </li>
        </ul>
      </div>
      <div class="sidebar-footer">
        <button class="sidebar-toggle-btn" id="sidebar-toggle" title="收缩侧边栏">
          <span class="toggle-icon">&lt;&lt;</span>
        </button>
      </div>
    </nav>
  `;
}

/**
 * Setup theme toggle functionality after the header is rendered
 * Should be called after the header HTML is added to the DOM
 */
export function setupThemeToggle(): void {
  const themeToggle = createThemeToggle();
  themeToggle.setup();
}

/**
 * Setup help modal functionality
 * Should be called after the header HTML is added to the DOM
 */
export function setupHelpModal(): void {
  const helpBtn = document.getElementById('help-btn');
  const modal = document.getElementById('help-modal');
  const closeBtn = document.getElementById('modal-close');

  if (!helpBtn || !modal || !closeBtn) return;

  helpBtn.addEventListener('click', () => {
    modal.classList.add('active');
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  // 点击遮罩层关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // ESC 键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
    }
  });
}

/**
 * Setup sidebar toggle functionality
 * Should be called after the sidebar HTML is added to the DOM
 */
export async function setupSidebarToggle(): Promise<void> {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const root = document.querySelector('.xzzdpro-root') as HTMLElement;

  if (!toggleBtn || !root) return;

  // Load and apply saved state
  try {
    const state = await storage.get<{ sidebarCollapsed?: boolean }>(LAYOUT_STORAGE_KEY);
    if (state?.sidebarCollapsed) {
      root.classList.add('sidebar-collapsed');
      toggleBtn.setAttribute('title', '展开侧边栏');
    }
  } catch (error) {
    console.error('XZZDPRO: Failed to load sidebar state', error);
  }

  // Setup click handler
  toggleBtn.addEventListener('click', async () => {
    const isCollapsed = root.classList.toggle('sidebar-collapsed');

    // Update title
    toggleBtn.setAttribute('title', isCollapsed ? '展开侧边栏' : '收缩侧边栏');

    // Save state
    try {
      const currentState = await storage.get<Record<string, unknown>>(LAYOUT_STORAGE_KEY) || {};
      await storage.set(LAYOUT_STORAGE_KEY, { ...currentState, sidebarCollapsed: isCollapsed });
      console.log('XZZDPRO: Sidebar toggled', { collapsed: isCollapsed });
    } catch (error) {
      console.error('XZZDPRO: Failed to save sidebar state', error);
    }
  });
}


/**
 * Setup avatar upload functionality
 * Should be called after the header HTML is added to the DOM
 */
export function setupAvatarUpload(): void {
  const container = document.getElementById('user-avatar-container');
  if (!container) return;

  const root = createRoot(container);
  root.render(React.createElement(AvatarUpload, {
    size: 'lg',
    fallback: 'U',
    className: 'user-avatar'
  }));
}

export function setupAssistantNavigation(): void {
  const link = document.getElementById('nav-assistant-link');
  const expandBtn = document.getElementById('nav-assistant-expand');
  const navItem = link?.closest('.nav-item-expandable');
  const submenu = navItem?.querySelector('.nav-submenu') as HTMLElement;
  
  if (!link || !expandBtn || !navItem || !submenu) return;

  // Toggle submenu on expand button click only
  expandBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isExpanded = navItem.classList.contains('expanded');
    if (isExpanded) {
      navItem.classList.remove('expanded');
      submenu.style.display = 'none';
    } else {
      navItem.classList.add('expanded');
      submenu.style.display = 'block';
      loadAssistantCourses();
    }
  });

  if (navItem.classList.contains('active')) {
    navItem.classList.add('expanded');
    submenu.style.display = 'block';
  }

  // Load courses on initial setup
  loadAssistantCourses();
}

async function loadAssistantCourses(): Promise<void> {
  const courseListEl = document.getElementById('assistant-course-list');
  if (!courseListEl) return;

  try {
    const activeCourseId = new URLSearchParams(window.location.search).get('courseId');
    // Dynamically import fetchAllCourses from assistant services
    const { fetchAllCourses } = await import('../../assistant/services/courseDataService');
    const courses = await fetchAllCourses();

    if (courses.length === 0) {
      courseListEl.innerHTML = '<div class="submenu-empty">暂无课程</div>';
      return;
    }

    // Render course list
    const courseHTML = courses
      .map((course) => `
        <a href="https://courses.zju.edu.cn/air?courseId=${course.id}" class="course-submenu-item ${String(course.id) === activeCourseId ? 'active' : ''}" data-course-id="${course.id}">
          <span class="course-name">${course.displayName || course.name}</span>
        </a>
      `)
      .join('');

    courseListEl.innerHTML = courseHTML;

    // Add click handlers for each course
    courseListEl.querySelectorAll('.course-submenu-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const courseId = item.getAttribute('data-course-id');
        if (courseId) {
          const onAssistantPage = !!document.querySelector('.nav-item-expandable.active');
          if (onAssistantPage) {
            window.dispatchEvent(new CustomEvent('xzzd:assistant-course-select', {
              detail: { courseId }
            }));
            courseListEl.querySelectorAll('.course-submenu-item').forEach((linkEl) => {
              if (linkEl.getAttribute('data-course-id') === courseId) {
                linkEl.classList.add('active');
              } else {
                linkEl.classList.remove('active');
              }
            });
            return;
          }
          window.location.assign(`https://courses.zju.edu.cn/air?courseId=${courseId}`);
        }
      });
    });
  } catch (error) {
    console.error('XZZDPRO: Failed to load assistant courses', error);
    courseListEl.innerHTML = '<div class="submenu-error">加载课程失败</div>';
  }
}
