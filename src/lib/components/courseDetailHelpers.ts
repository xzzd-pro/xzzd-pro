// lib/courseDetailHelpers.ts - Shared helpers for all course detail pages

import { renderHeader, setupThemeToggle, setupHelpModal, setupAvatarUpload, setupSidebarToggle } from "./layoutHelpers"
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

// Get user ID by fetching from API - iterates through all courses until a valid userId is found
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

    if (!coursesResponse.ok) {
      console.error('XZZDPRO: 获取课程列表失败');
      return null;
    }

    const coursesData = await coursesResponse.json();
    if (!coursesData.courses || coursesData.courses.length === 0) {
      console.error('XZZDPRO: 没有找到任何课程');
      return null;
    }

    // Iterate through all courses until we find a valid userId
    for (const course of coursesData.courses) {
      const courseId = course.id;
      try {
        const activityResponse = await fetch(
          `https://courses.zju.edu.cn/api/course/${courseId}/activity-reads-for-user`
        );

        if (!activityResponse.ok) continue;

        const activityData = await activityResponse.json();
        if (!activityData.activity_reads || activityData.activity_reads.length === 0) continue;

        const firstActivity = activityData.activity_reads[0];
        const userId = firstActivity.created_by_id || firstActivity.created_for_id;

        if (userId) {
          console.log('XZZDPRO: 成功提取到用户ID', userId);
          return String(userId);
        }
      } catch (error) {
        console.warn(`XZZDPRO: 处理课程 ${courseId} 时发生异常`, error);
      }
    }

    console.error('XZZDPRO: 遍历所有课程均无法提取有效用户ID');
    return null;
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

/**
 * Render course detail sidebar with navigation items
 * @param courseId - The course ID
 * @param currentPage - The current active page
 * @returns HTML string for the sidebar
 */
export function renderCourseDetailSidebar(courseId: string, currentPage: string): string {
  return `
    <nav class="xzzdpro-sidebar">
      <div class="sidebar-section">
        <ul class="sidebar-nav">
          <li class="nav-item ${currentPage === 'overview' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/content#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.overview}</span>
              <span class="nav-text">课程概览</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'materials' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/courseware#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.courseware}</span>
              <span class="nav-text">课件下载</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'homework' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/homework#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.homework}</span>
              <span class="nav-text">作业提交</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'quiz' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/exam" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.quiz}</span>
              <span class="nav-text">小测</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'discussion' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/forum#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.discussion}</span>
              <span class="nav-text">讨论区</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'grades' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/score#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.grades}</span>
              <span class="nav-text">成绩</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="https://courses.zju.edu.cn/user/courses#/" class="nav-link">
              <span class="nav-icon">${courseDetailIcons.back}</span>
              <span class="nav-text">返回课程</span>
            </a>
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
 * Render common page structure for course detail pages
 * @param courseId - The course ID
 * @param courseName - The course name
 * @param currentPage - The current active page
 * @param pageTitle - The page title
 * @param contentHtml - The main content HTML
 * @returns HTML string for the complete page
 */
export function renderCourseDetailPage(
  courseId: string,
  courseName: string,
  currentPage: string,
  pageTitle: string,
  contentHtml: string
): string {
  const header = renderHeader({ showUsername: false });
  const sidebar = renderCourseDetailSidebar(courseId, currentPage);

  return `
    ${header}
    ${sidebar}

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

// Re-export setup functions from layoutHelpers for convenience
export { setupThemeToggle, setupHelpModal, setupAvatarUpload, setupSidebarToggle } from "./layoutHelpers";
