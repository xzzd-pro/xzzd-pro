// lib/coursePageBeautifier

import { Storage } from "@plasmohq/storage"
import { createThemeToggle } from "./components/themeToggle"
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
          <p class="course-instructor">👨‍🏫 ${instructors}</p>
          ${teachingClass ? `<p class="course-time">📅 ${teachingClass}</p>` : ''}
        </div>
      </a>
    `;
  }).join('');

  container.innerHTML = coursesHtml;
}

function setupSearchHandler() {
  const searchBtn = $('#course-search-btn');
  const keywordInput = $('#course-keyword') as HTMLInputElement;
  const semesterSelect = $('#course-semester') as HTMLSelectElement;
  const statusCheckboxes = $$('input[name="course-status"]') as NodeListOf<HTMLInputElement>;

  if (!searchBtn) return;

  searchBtn.addEventListener('click', () => {
    const keyword = keywordInput?.value || '';
    const semester = semesterSelect?.value || '';

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

    if (semester) {
      filters.semester_id = [semester];
    }

    loadAndRenderCourses(filters);
  });
}

export function coursePageBeautifier(): void {
  console.log('XZZDPRO: 准备接管课程页...');

  const usernameElement = $('#userCurrentName');
  const username = usernameElement ? usernameElement.textContent.trim() : '同学';
  const logoSrc = '';

  const themeToggle = createThemeToggle();

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root';

  root.innerHTML = `
    <header class="xzzdpro-header">
      <div class="logo-area">
        ${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : 'Logo 区域'}
      </div>
      <div class="right-section">
        ${themeToggle.renderHTML()}
        <span class="icon">🔔</span>
        <div class="user-profile">
          <span class="user-avatar"></span>
          <span class="username">${username}</span>
        </div>
      </div>
    </header>

    <nav class="xzzdpro-sidebar">
      <ul class="sidebar-nav">
        <li class="nav-item">
          <a href="https://courses.zju.edu.cn/user/index#/" class="nav-link">
            <span class="nav-icon">🏠</span><span class="nav-text">主页</span>
          </a>
        </li>
        <li class="nav-item active">
          <a href="https://courses.zju.edu.cn/user/courses#/" class="nav-link">
            <span class="nav-icon">📊</span><span class="nav-text">课程</span>
          </a>
        </li>
        <li class="nav-item">
          <a href="https://courses.zju.edu.cn/bulletin-list/#/" class="nav-link">
           <span class="nav-icon">📢</span><span class="nav-text">公告</span>
          </a>
        </li>
        <li class="nav-item">
           <a href="#" class="nav-link"><span class="nav-icon">🤖</span><span class="nav-text">学习助理</span></a>
        </li>
      </ul>
    </nav>

    <main class="xzzdpro-main">
      <div class="widget-card search-card">
        <h3>🔍 搜索课程</h3>
        <div class="search-form">
          <div class="form-row">
            <div class="form-group">
              <label for="course-keyword">关键词</label>
              <input type="text" id="course-keyword" placeholder="课程名称或教师" class="form-input">
            </div>
            <div class="form-group">
              <label for="course-semester">学期</label>
              <select id="course-semester" class="form-select">
                <option value="">全部学期</option>
                <option value="78">2024-2025学年第一学期</option>
                <option value="79">2024-2025学年第二学期</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>课程状态</label>
              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" name="course-status" value="ongoing" checked>
                  <span>进行中</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" name="course-status" value="notStarted" checked>
                  <span>未开始</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" name="course-status" value="closed" checked>
                  <span>已结束</span>
                </label>
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button id="course-search-btn" class="btn-primary">搜索</button>
          </div>
        </div>
      </div>

      <div class="widget-card courses-card">
        <h3>📚 我的课程</h3>
        <div class="courses-grid-container">
          ${getLoadingHtml('正在加载课程...')}
        </div>
      </div>
    </main>
  `;

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  themeToggle.setup();
  setupSearchHandler();

  console.log('XZZDPRO: 页面骨架渲染完成，开始异步加载数据...');

  loadAndRenderCourses();
}