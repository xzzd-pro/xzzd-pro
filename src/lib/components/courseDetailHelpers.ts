// lib/courseDetailHelpers.ts - Shared helpers for all course detail pages

import { createThemeToggle } from "./themeToggle"

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

    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}/outline`);
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
      </div>
      <div class="right-section">
        ${themeToggle.renderHTML()}
        <div class="user-profile">
          <span class="user-avatar"></span>
        </div>
      </div>
    </header>

    <nav class="xzzdpro-sidebar">
      <div class="sidebar-content">
        <div class="course-title">
          <h3>${courseName}</h3>
        </div>
        <ul class="sidebar-nav">
          <li class="nav-item ${currentPage === 'overview' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/content#/" class="nav-link">
              <span class="nav-icon">📋</span><span class="nav-text">课程概览</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'materials' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/courseware#/" class="nav-link">
              <span class="nav-icon">📚</span><span class="nav-text">课件下载</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'homework' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/homework#/" class="nav-link">
              <span class="nav-icon">✍️</span><span class="nav-text">作业提交</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'quiz' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/exam" class="nav-link">
              <span class="nav-icon">📝</span><span class="nav-text">小测</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'discussion' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/forum#/" class="nav-link">
              <span class="nav-icon">💬</span><span class="nav-text">讨论区</span>
            </a>
          </li>
          <li class="nav-item ${currentPage === 'grades' ? 'active' : ''}">
            <a href="https://courses.zju.edu.cn/course/${courseId}/score#/" class="nav-link">
              <span class="nav-icon">📊</span><span class="nav-text">成绩</span>
            </a>
          </li>
        </ul>
      </div>
      <div class="sidebar-footer">
        <a href="https://courses.zju.edu.cn/user/index#/" class="back-btn">
          <span class="back-icon">←</span>
          <span class="back-text">返回主页</span>
        </a>
      </div>
    </nav>

    <main class="xzzdpro-main">
      <div class="widget-card content-card">
        <div class="content-section active">
          <h2>${pageTitle}</h2>
          ${contentHtml}
        </div>
      </div>
    </main>
  `;
}

// Setup theme toggle
export function setupThemeToggle(): void {
  const themeToggle = createThemeToggle();
  themeToggle.setup();
}
