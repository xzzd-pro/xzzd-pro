// lib/courseDetailHelpers.ts - Shared helpers for all course detail pages

import { renderHeader, setupThemeToggle, setupHelpModal, setupAvatarUpload, setupSidebarToggle } from "../layout"
import { courseDetailIcons } from "../layout/icons"
import { createMyCoursesPayload, fetchMyCoursesResponse } from "@/shared/api/myCoursesApi"
import { suppressAirChatbot } from "@/shared/contentScripts/pageLifecycle"

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
    const coursesResponse = await fetchMyCoursesResponse(
      createMyCoursesPayload()
    );

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
  const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const descriptions: Record<string, string> = {
    materials: '按章节浏览课程资料，预览或下载所需文件。',
    homework: '查看作业要求、提交记录与批改结果。',
    grades: '查看课程公布的成绩与各项学习记录。',
    overview: '了解课程信息、任课教师与课程介绍。'
  };

  return `
    ${header}
    ${sidebar}

    <main class="xzzdpro-main course-detail-main" id="main-grid">
      <div class="main-content-wrapper course-detail-content">
        <header class="course-detail-heading">
          <nav class="course-detail-breadcrumb" aria-label="当前位置">
            <a href="https://courses.zju.edu.cn/user/courses#/">我的课程</a>
            <span aria-hidden="true">/</span>
            <span class="course-detail-course-name">${escapeText(courseName)}</span>
          </nav>
          <h1>${escapeText(pageTitle)}</h1>
          ${descriptions[currentPage] ? `<p>${descriptions[currentPage]}</p>` : ''}
        </header>
        <div class="widget-card content-card course-detail-panel">
          <div class="content-section active">
            ${contentHtml}
          </div>
        </div>
      </div>
    </main>
  `;
}

interface MountCourseDetailPageOptions {
  currentPage: string;
  pageTitle: string;
  contentHtml: string;
  courseName?: string;
}

interface MountedCourseDetailPage {
  courseId: string;
  root: HTMLElement;
  titleElement: HTMLElement | null;
  contentSection: HTMLElement | null;
  getMountPoint: (id: string) => HTMLElement | null;
}

function setupCourseDetailLayout(): void {
  setupThemeToggle();
  setupHelpModal();
  setupAvatarUpload();
  void setupSidebarToggle();
}

export async function mountCourseDetailPage({
  currentPage,
  pageTitle,
  contentHtml,
  courseName
}: MountCourseDetailPageOptions): Promise<MountedCourseDetailPage | null> {
  suppressAirChatbot();

  const courseId = getCourseIdFromUrl();
  if (!courseId) {
    console.error('XZZDPRO: 无法提取课程ID');
    return null;
  }

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root xzzdpro';

  const resolvedCourseName = courseName ?? (await getCourseName());

  root.innerHTML = renderCourseDetailPage(
    courseId,
    resolvedCourseName,
    currentPage,
    pageTitle,
    contentHtml
  );

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body', 'xzzdpro');

  setupCourseDetailLayout();

  return {
    courseId,
    root,
    titleElement: root.querySelector('.course-detail-course-name'),
    contentSection: document.querySelector('.content-section.active'),
    getMountPoint: (id: string) => document.getElementById(id)
  };
}

// Re-export setup functions from layoutHelpers for convenience
export { setupThemeToggle, setupHelpModal, setupAvatarUpload, setupSidebarToggle } from "../layout";
