// lib/coursePageBeautifier

import { Storage } from "@plasmohq/storage"
import { renderHeader, renderSidebar, setupThemeToggle, setupHelpModal, setupSidebarToggle } from "./components/layoutHelpers"
import type { ApiCourseData } from "../types"

const $ = (selector: string): HTMLElement | null => document.querySelector(selector);
const $$ = (selector: string): NodeListOf<HTMLElement> => document.querySelectorAll(selector);

interface CourseFilters {
  semester_id?: string[];
  status?: string[];
  keyword?: string;
  classify_type?: string;
}

/* get courses api */
async function fetchCoursesFromApi(filters: CourseFilters = {}): Promise<ApiCourseData[]> {
  try {
    const payload = {
      conditions: {
        semester_id: filters.semester_id || [],
        status: filters.status || ["ongoing", "notStarted", "closed"],
        keyword: filters.keyword || "",
        classify_type: filters.classify_type || "recently_started",
        display_studio_list: false
      },
      showScorePassedStatus: false
    };

    const response = await fetch('https://courses.zju.edu.cn/api/my-courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('XZZDPRO: 课程API请求失败', response.status);
      return [];
    }

    const data = await response.json();

    if (data.courses && Array.isArray(data.courses)) {
      return data.courses;
    }

    console.warn('XZZDPRO: 未找到预期的课程数据结构', data);
    return [];
  } catch (error) {
    console.error('XZZDPRO: 课程网络请求出错', error);
    return [];
  }
}

function generateCourseUrl(courseId: number): string {
  if (!courseId) return '#';
  return `https://courses.zju.edu.cn/course/${courseId}/content#/`;
}

function getLoadingHtml(text: string = '加载中...'): string {
  return `
    <div class="xzzd-loading-state">
      <span class="spinner">⏳</span> ${text}
    </div>
  `;
}

async function loadAndRenderCourses(filters: CourseFilters = {}) {
  const container = $('.courses-grid-container');
  if (!container) return;

  container.innerHTML = getLoadingHtml('正在加载课程...');

  let courses: ApiCourseData[] = [];
  try {
    courses = await fetchCoursesFromApi(filters);
  } catch (e) {
    console.warn('XZZDPRO: 获取课程异常', e);
  }

  if (courses.length === 0) {
    container.innerHTML = '<p class="no-courses-message">未找到符合条件的课程</p>';
    return;
  }

  const coursesHtml = courses.map(course => {
    const courseName = course.display_name || course.name;
    const instructors = course.instructors.map(i => i.name).join('、');
    const teachingClass = course.course_attributes?.teaching_class_name || '';
    const courseUrl = generateCourseUrl(course.id);

    return `
      <a href="${courseUrl}" class="course-card">
        <div class="course-card-header">
          <h4 class="course-name">${courseName}</h4>
        </div>
        <div class="course-card-body">
          <p class="course-instructor">授课老师： ${instructors}</p>
          ${teachingClass ? `<p class="course-time">上课时间： ${teachingClass}</p>` : ''}
        </div>
      </a>
    `;
  }).join('');

  container.innerHTML = coursesHtml;
}

function setupSearchHandler() {
  const searchBtn = $('#course-search-btn');
  const keywordInput = $('#course-keyword') as HTMLInputElement;
  const statusCheckboxes = $$('input[name="course-status"]') as NodeListOf<HTMLInputElement>;

  if (!searchBtn) return;

  const doSearch = () => {
    const keyword = keywordInput?.value || '';

    const selectedStatus: string[] = [];
    statusCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        selectedStatus.push(checkbox.value);
      }
    });

    const filters: CourseFilters = {
      keyword,
      status: selectedStatus.length > 0 ? selectedStatus : ["ongoing", "notStarted", "closed"]
    };

    loadAndRenderCourses(filters);
  };

  // 点击搜索按钮
  searchBtn.addEventListener('click', doSearch);

  // 回车搜索
  keywordInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch();
    }
  });
}

export function coursePageBeautifier(): void {
  console.log('XZZDPRO: 准备接管课程页...');

  const usernameElement = $('#userCurrentName');
  const username = usernameElement ? usernameElement.textContent.trim() : '同学';

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

  root.innerHTML = `
    ${renderHeader({ username, showUsername: true })}

    ${renderSidebar({ currentPage: 'courses' })}

    <main class="xzzdpro-main" id="main-grid">
      <div class="resize-handle resize-handle-left"></div>
      <div class="main-content-wrapper">
        <div class="widget-card search-card">
          <div class="search-form">
            <div class="search-row">
              <div class="search-input-wrapper">
                <input type="text" id="course-keyword" placeholder="搜索课程名称或教师..." class="form-input search-input">
                <button id="course-search-btn" class="search-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <span>搜索</span>
                </button>
              </div>
              <div class="filter-chips">
                <label class="filter-chip">
                  <input type="checkbox" name="course-status" value="ongoing" checked>
                  <span>进行中</span>
                </label>
                <label class="filter-chip">
                  <input type="checkbox" name="course-status" value="notStarted" checked>
                  <span>未开始</span>
                </label>
                <label class="filter-chip">
                  <input type="checkbox" name="course-status" value="closed" checked>
                  <span>已结束</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="widget-card courses-card">
          <h3>我的课程</h3>
          <div class="courses-grid-container">
            ${getLoadingHtml('正在加载课程...')}
          </div>
        </div>
      </div>
      <div class="resize-handle resize-handle-right"></div>
    </main>
  `;

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();
  setupHelpModal();
  setupSidebarToggle();
  setupSearchHandler();

  console.log('XZZDPRO: 页面骨架渲染完成，开始异步加载数据...');

  loadAndRenderCourses();
}