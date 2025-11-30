// lib/components/layoutHelpers.ts - Shared layout components for header and sidebar

import { createThemeToggle } from "./themeToggle"
import { navIcons } from "./navIcons"
import { Storage } from "@plasmohq/storage"

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
  const { username = '同学', showUsername = true } = options;
  const themeToggle = createThemeToggle();

  return `
    <header class="xzzdpro-header">
      <div class="logo-area">
        ${LOGO_SRC ? `<img src="${LOGO_SRC}" alt="Logo">` : 'Logo 区域'}
        <button class="help-btn" id="help-btn" title="使用须知">
          <span>使用须知</span>
        </button>
      </div>
      <div class="right-section">
        ${themeToggle.renderHTML()}
        <div class="user-profile">
          <span class="user-avatar"></span>
          ${showUsername ? `<span class="username">${username}</span>` : ''}
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
      <button class="sidebar-toggle-btn" id="sidebar-toggle" title="收缩侧边栏">
        <span class="toggle-icon">&lt;&lt;</span>
      </button>
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
