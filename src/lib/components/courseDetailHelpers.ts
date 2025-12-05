// lib/courseDetailHelpers.ts - Shared helpers for all course detail pages

import { createThemeToggle } from "./themeToggle"
import { courseDetailIcons } from "./icons"
import { Storage } from "@plasmohq/storage"

const storage = new Storage()
const LAYOUT_STORAGE_KEY = "indexPageLayout"

const $ = (selector: string): HTMLElement | null => document.querySelector(selector);

// Extract course ID from URL
export function getCourseIdFromUrl(): string | null {
  const pathname = window.location.pathname;
  const courseMatch = pathname.match(/\/course\/(\d+)/);
  return courseMatch ? courseMatch[1] : null;
}

// Extract activity ID from URL hash
export function getActivityIdFromUrl(): string | null {
  const hash = window.location.hash;
  const activityMatch = hash.match(/#\/(?:exam\/)?(\d+)/);
  return activityMatch ? activityMatch[1] : null;
}

// Get course name from API
export async function getCourseName(): Promise<string> {
  try {
    const courseId = getCourseIdFromUrl();
    if (!courseId) return '课程';

    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}`);
    if (!response.ok) return '课程';

    const data = await response.json();
    return data.display_name || '课程';
  } catch (error) {
    console.error('XZZDPRO: 获取课程名称时出错', error);
    return '课程';
  }
}

// Get user ID by fetching from API
export async function getUserId(): Promise<string | null> {
  try {
    const coursesResponse = await fetch('https://courses.zju.edu.cn/api/my-courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conditions: {
          semester_id: [],
          status: ["ongoing", "notStarted", "closed"],
          keyword: "",
          classify_type: "recently_started",
          display_studio_list: false
        },
        showScorePassedStatus: false
      })
    });

    if (!coursesResponse.ok) return null;
    const coursesData = await coursesResponse.json();
    if (!coursesData.courses || coursesData.courses.length === 0) return null;

    const courseId = coursesData.courses[0].id;
    const activityResponse = await fetch(
      `https://courses.zju.edu.cn/api/course/${courseId}/activity-reads-for-user`
    );

    if (!activityResponse.ok) return null;
    const activityData = await activityResponse.json();
    if (!activityData.activity_reads || activityData.activity_reads.length === 0) return null;

    const userId = activityData.activity_reads[0].created_by_id || activityData.activity_reads[0].created_for_id;
    return userId ? String(userId) : null;
  } catch (error) {
    console.error('XZZDPRO: 获取用户ID时出错', error);
    return null;
  }
}

// Detect if activity is courseware or homework by checking API
export async function detectActivityType(activityId: string, userId: string): Promise<'courseware' | 'homework' | 'unknown'> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/activities/${activityId}/students/${userId}/homework-score`
    );

    const data = await response.json();

    // If returns "未找到资源" message, it's a courseware page
    if (data.message && data.message.includes('未找到资源')) {
      return 'courseware';
    }

    return 'homework';
  } catch (error) {
    console.error('XZZDPRO: 检测活动类型时出错', error);
    return 'unknown';
  }
}

// Render common page structure
export function renderCourseDetailPage(
  courseId: string,
  courseName: string,
  currentPage: string,
  pageTitle: string,
  contentHtml: string
): string {
  const logoSrc = 'https://courses.zju.edu.cn/api/uploads/57/modified-image?thumbnail=0x272';
  const themeToggle = createThemeToggle();

  return `
    <header class="xzzdpro-header">
      <div class="logo-area">
        ${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : 'Logo 区域'}
        <button class="help-btn" id="help-btn" title="使用须知">
          <span>使用须知</span>
        </button>
      </div>
      <div class="right-section">
        ${themeToggle.renderHTML()}
        <div class="user-profile">
          <span class="user-avatar"></span>
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

    <nav class="xzzdpro-sidebar">
      <div class="sidebar-content">
        <div class="course-title">
          <h3> 课程详情 </h3>
        </div>
        <ul class="sidebar-nav">
          <li class="nav-item ${currentPage === 'overview' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/content#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.overview}</span><span class="nav-text">课程概览</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'materials' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/courseware#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.courseware}</span><span class="nav-text">课件下载</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'homework' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/homework#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.homework}</span><span class="nav-text">作业提交</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'quiz' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/exam" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.quiz}</span><span class="nav-text">小测</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'discussion' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/forum#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.discussion}</span><span class="nav-text">讨论区</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'grades' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/score#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.grades}</span><span class="nav-text">成绩</span>
            </a>
          </li>
        </ul>
        <button class="sidebar-toggle-btn" id="sidebar-toggle" title="收缩侧边栏">
          <span class="toggle-icon">&lt;&lt;</span>
        </button>
      </div>
      <div class="sidebar-footer">
        <a href="https://courses.zju.edu.cn/user/courses#/" class="back-btn">
          <span class="back-icon">←</span>
          <span class="back-text">返回课程</span>
        </a>
      </div>
    </nav>

    <main class="xzzdpro-main" id="main-grid">
      <div class="resize-handle resize-handle-left"></div>
      <div class="main-content-wrapper">
        <div class="widget-card title-card">
          <h2>${courseName}</h2>
        </div>
        <div class="widget-card content-card">
          <div class="content-section active">
            <h2>${pageTitle}</h2>
            ${contentHtml}
          </div>
        </div>
      </div>
      <div class="resize-handle resize-handle-right"></div>
    </main>
  `;
}

// Setup theme toggle
export function setupThemeToggle(): void {
  const themeToggle = createThemeToggle();
  themeToggle.setup();
}

// Setup help modal functionality
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

// Setup sidebar toggle functionality
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
