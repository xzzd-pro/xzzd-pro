// lib/courseOverviewBeautifier.tsx

import { getCourseIdFromUrl, renderCourseDetailPage, setupThemeToggle, setupHelpModal, setupSidebarToggle, setupAvatarUpload } from "./components/courseDetailHelpers"

interface Instructor {
  id: number;
  name: string;
  avatar_big_url?: string;
  avatar_small_url?: string;
  email?: string;
}

interface CourseOutlineField {
  id?: number;
  key: string;
  title: string;
  description: string;
}

interface CourseData {
  id: number;
  display_name: string;
  name: string;
  course_code: string;
  start_date: string | null;
  department?: {
    id: number;
    code: string;
    name: string;
  };
  semester?: {
    id: number;
    code: string;
    name: string;
  };
  course_attributes?: {
    teaching_class_name?: string;
    student_count?: number;
  };
  instructors?: Instructor[];
  course_outline?: {
    common_fields?: CourseOutlineField[];
  };
}

// Generate skeleton loading HTML
function getLoadingHtml(): string {
  return `
    <div class="course-overview-content">
      <div class="course-info-section">
        <h3 class="section-title">课程信息</h3>
        <div class="course-info-grid">
          ${Array(6).fill('').map(() => `
            <div class="info-item">
              <span class="skeleton-item skeleton-label"></span>
              <span class="skeleton-item skeleton-value"></span>
            </div>
          `).join('')}
        </div>
        <div class="instructors-section">
          <span class="skeleton-item skeleton-label"></span>
          <div class="instructors-list">
            <div class="instructor-item">
              <div class="skeleton-item skeleton-avatar"></div>
              <span class="skeleton-item skeleton-name"></span>
            </div>
          </div>
        </div>
      </div>
      <div class="course-description-section">
        <div class="description-block">
          <h3 class="section-title">课程简介（中文）</h3>
          <div class="description-content">
            <div class="skeleton-item skeleton-line"></div>
            <div class="skeleton-item skeleton-line"></div>
            <div class="skeleton-item skeleton-line short"></div>
          </div>
        </div>
        <div class="description-block">
          <h3 class="section-title">课程简介（英文）</h3>
          <div class="description-content">
            <div class="skeleton-item skeleton-line"></div>
            <div class="skeleton-item skeleton-line"></div>
            <div class="skeleton-item skeleton-line short"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function fetchCourseData(courseId: string): Promise<CourseData | null> {
  try {
    const response = await fetch(`https://courses.zju.edu.cn/api/courses/${courseId}`);
    if (!response.ok) {
      console.error('XZZDPRO: 获取课程数据失败', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('XZZDPRO: 获取课程数据时出错', error);
    return null;
  }
}

function renderCourseInfo(data: CourseData): string {
  const instructorsHtml = data.instructors?.map(instructor => `
    <div class="instructor-item">
      <img
        class="instructor-avatar"
        src="${instructor.avatar_big_url || instructor.avatar_small_url || ''}"
        alt="${instructor.name}"
        onerror="this.style.display='none'"
      />
      <span class="instructor-name">${instructor.name}</span>
    </div>
  `).join('') || '<span class="no-data">暂无信息</span>';

  return `
    <div class="course-info-section">
      <h3 class="section-title">课程信息</h3>
      <div class="course-info-grid">
        <div class="info-item">
          <span class="info-label">课程名称</span>
          <span class="info-value">${data.display_name || data.name || '暂无信息'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">课程代码</span>
          <span class="info-value">${data.course_code || '暂无信息'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">开课院系</span>
          <span class="info-value">${data.department?.name || '暂无信息'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">上课学期</span>
          <span class="info-value">${data.semester?.name || '暂无信息'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">开始日期</span>
          <span class="info-value">${data.start_date || '暂无信息'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">授课班级</span>
          <span class="info-value">${data.course_attributes?.teaching_class_name || '暂无信息'}</span>
        </div>
      </div>
      <div class="instructors-section">
        <span class="info-label">授课教师</span>
        <div class="instructors-list">
          ${instructorsHtml}
        </div>
      </div>
    </div>
  `;
}

function renderCourseDescription(data: CourseData): string {
  const commonFields = data.course_outline?.common_fields || [];

  const chineseDesc = commonFields.find(f => f.key === 'comment_chinese');
  const englishDesc = commonFields.find(f => f.key === 'comment_english');

  const chineseContent = chineseDesc?.description?.trim() || '暂无课程简介';
  const englishContent = englishDesc?.description?.trim() || 'No course description available';

  return `
    <div class="course-description-section">
      <div class="description-block">
        <h3 class="section-title">课程简介（中文）</h3>
        <div class="description-content">
          <p>${chineseContent}</p>
        </div>
      </div>
      <div class="description-block">
        <h3 class="section-title">课程简介（英文）</h3>
        <div class="description-content">
          <p>${englishContent}</p>
        </div>
      </div>
    </div>
  `;
}

function renderOverviewContent(data: CourseData | null): string {
  if (!data) {
    return `<p class="error-message">无法加载课程信息，请刷新页面重试</p>`;
  }

  return `
    <div class="course-overview-content">
      ${renderCourseInfo(data)}
      ${renderCourseDescription(data)}
    </div>
  `;
}

export async function courseOverviewBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管课程概览页...');

  // 移除 chatbot 并监视动态添加
  const removeChatbot = () => {
    document.querySelectorAll('air-chatbot-app').forEach(el => el.remove());
  };
  removeChatbot();

  const observer = new MutationObserver(() => {
    removeChatbot();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 5秒后停止监视
  setTimeout(() => observer.disconnect(), 5000);

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root';

  const courseId = getCourseIdFromUrl();
  if (!courseId) {
    console.error('XZZDPRO: 无法提取课程ID');
    return;
  }

  // 先显示骨架加载状态
  const loadingHtml = getLoadingHtml();

  root.innerHTML = renderCourseDetailPage(
    courseId,
    '课程概览',
    'overview',
    '课程概览',
    loadingHtml
  );

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();
  setupHelpModal();
  setupAvatarUpload();
  setupSidebarToggle();

  // 获取课程数据
  const courseData = await fetchCourseData(courseId);

  // 更新页面标题和内容
  const titleCard = document.querySelector('.title-card h2');
  if (titleCard && courseData) {
    titleCard.textContent = courseData.display_name || courseData.name || '课程概览';
  }

  const contentSection = document.querySelector('.content-section.active');
  if (contentSection) {
    contentSection.innerHTML = `
      <h2>课程概览</h2>
      ${renderOverviewContent(courseData)}
    `;
  }

  console.log('XZZDPRO: 课程概览页面渲染完成');
}
