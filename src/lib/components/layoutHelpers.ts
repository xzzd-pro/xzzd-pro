// lib/components/layoutHelpers.ts - Shared layout components for header and sidebar

import { createThemeToggle } from "./themeToggle"
import { navIcons } from "./navIcons"

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
  const { username = '同学', showUsername = true } = options;
  const themeToggle = createThemeToggle();

  return `
    <header class="xzzdpro-header">
      <div class="logo-area">
        ${LOGO_SRC ? `<img src="${LOGO_SRC}" alt="Logo">` : 'Logo 区域'}
      </div>
      <div class="right-section">
        ${themeToggle.renderHTML()}
        <div class="user-profile">
          <span class="user-avatar"></span>
          ${showUsername ? `<span class="username">${username}</span>` : ''}
        </div>
      </div>
    </header>
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
      <ul class="sidebar-nav">
        <li class="nav-item ${currentPage === 'home' ? 'active' : ''}">
          <a href="https://courses.zju.edu.cn/user/index#/" class="nav-link">
            <span class="nav-icon">${navIcons.home}</span><span class="nav-text">主页</span>
          </a>
        </li>
        <li class="nav-item ${currentPage === 'notification' ? 'active' : ''}">
          <a href="https://courses.zju.edu.cn/bulletin-list/#/" class="nav-link">
           <span class="nav-icon">${navIcons.notification}</span><span class="nav-text">动态</span>
          </a>
        </li>
        <li class="nav-item ${currentPage === 'courses' ? 'active' : ''}">
          <a href="https://courses.zju.edu.cn/user/courses#/" class="nav-link">
            <span class="nav-icon">${navIcons.courses}</span><span class="nav-text">课程</span>
          </a>
        </li>
        <li class="nav-item ${currentPage === 'assistant' ? 'active' : ''}">
           <a href="#" class="nav-link"><span class="nav-icon">${navIcons.assistant}</span><span class="nav-text">学习助理</span></a>
        </li>
      </ul>
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
