// lib/coursewareBeautifier.tsx

import { renderCourseDetailPage, setupThemeToggle, getCourseIdFromUrl, getCourseName } from "./components/courseDetailHelpers"
import type { CoursewareApiResponse, CoursewareActivity, ProcessedCoursewareSection, ProcessedCoursewareFile } from "../types"

// Fetch coursewares for a course
async function fetchCoursewares(courseId: string): Promise<CoursewareActivity[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/course/${courseId}/coursewares`
    );

    if (!response.ok) {
      console.error('XZZDPRO: 获取课件失败', response.status);
      return [];
    }

    const data: CoursewareApiResponse = await response.json();
    return data.activities || [];
  } catch (error) {
    console.error('XZZDPRO: 获取课件时出错', error);
    return [];
  }
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Get file extension icon
function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    'pdf': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>`,
    'doc': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M9 13h6"/><path d="M9 17h3"/></svg>`,
    'docx': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M9 13h6"/><path d="M9 17h3"/></svg>`,
    'ppt': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><rect x="8" y="12" width="8" height="6" rx="1"/></svg>`,
    'pptx': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><rect x="8" y="12" width="8" height="6" rx="1"/></svg>`,
    'xls': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M8 13h8M8 17h8M12 13v8"/></svg>`,
    'xlsx': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M8 13h8M8 17h8M12 13v8"/></svg>`,
    'zip': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V3h12l6 5z"/><path d="M12 3v6h-2v2h2v2h-2v2h2v6"/></svg>`,
    'rar': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V3h12l6 5z"/><path d="M12 3v6h-2v2h2v2h-2v2h2v6"/></svg>`,
    'mp4': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,3 19,12 5,21"/></svg>`,
    'mp3': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    'jpg': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>`,
    'jpeg': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>`,
    'png': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>`,
  };
  return iconMap[ext] || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>`;
}

// Process coursewares into sections
function processCourseware(activities: CoursewareActivity[]): ProcessedCoursewareSection[] {
  return activities.map(activity => ({
    id: activity.id,
    title: activity.title,
    isStarted: activity.is_started,
    isClosed: activity.is_closed,
    completionCriterion: activity.completion_criterion || '无要求',
    files: (activity.uploads || []).map(upload => ({
      id: upload.id,
      name: upload.name,
      size: upload.size,
      sizeText: formatFileSize(upload.size),
      canDownload: upload.allow_download,
      downloadUrl: `https://courses.zju.edu.cn/api/uploads/${upload.id}/blob`
    }))
  }));
}

// Render a single file item
function renderFileItem(file: ProcessedCoursewareFile): string {
  return `
    <div class="courseware-file">
      <div class="file-icon">${getFileIcon(file.name)}</div>
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-size">${file.sizeText}</div>
      </div>
      <div class="file-actions">
        ${file.canDownload
          ? `<a href="${file.downloadUrl}" class="download-btn" download="${file.name}" target="_blank">
              <svg class="download-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>下载</span>
            </a>`
          : `<span class="download-disabled">不可下载</span>`
        }
      </div>
    </div>
  `;
}

// Render a single section
function renderSection(section: ProcessedCoursewareSection, index: number): string {
  const statusClass = section.isClosed ? 'closed' : (section.isStarted ? 'started' : 'not-started');
  const statusText = section.isClosed ? '已关闭' : (section.isStarted ? '进行中' : '未开始');
  const filesHtml = section.files.length > 0
    ? section.files.map(file => renderFileItem(file)).join('')
    : '<p class="no-files-message">该章节暂无课件</p>';

  return `
    <div class="courseware-section ${statusClass}" data-section-id="${section.id}">
      <div class="section-header" data-index="${index}">
        <div class="section-expand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>
        <div class="section-title-wrapper">
          <h3 class="section-title">${section.title}</h3>
          <div class="section-meta">
            <span class="section-status ${statusClass}">${statusText}</span>
            <span class="section-criterion">${section.completionCriterion}</span>
            <span class="section-file-count">${section.files.length} 个文件</span>
          </div>
        </div>
      </div>
      <div class="section-content">
        <div class="section-files">
          ${filesHtml}
        </div>
      </div>
    </div>
  `;
}

// Render all sections
function renderCoursewareList(sections: ProcessedCoursewareSection[]): string {
  if (sections.length === 0) {
    return '<p class="no-materials-message">暂无课件</p>';
  }

  return `
    <div class="courseware-sections">
      ${sections.map((section, index) => renderSection(section, index)).join('')}
    </div>
  `;
}

// Setup section toggle handlers
function setupSectionToggles() {
  const headers = document.querySelectorAll('.section-header');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.courseware-section');
      if (section) {
        section.classList.toggle('expanded');
      }
    });
  });
}

// Load and render coursewares
async function loadAndRenderCoursewares(courseId: string) {
  const container = document.querySelector('#materials-list');
  if (!container) return;

  container.innerHTML = '<p class="loading-message">正在加载课件...</p>';

  const activities = await fetchCoursewares(courseId);
  const sections = processCourseware(activities);

  container.innerHTML = renderCoursewareList(sections);

  // Setup toggle handlers after rendering
  setupSectionToggles();
}

export async function coursewareBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管课件下载页...');

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root';

  const courseId = getCourseIdFromUrl();
  if (!courseId) {
    console.error('XZZDPRO: 无法提取课程ID');
    return;
  }

  const courseName = await getCourseName();

  const contentHtml = `
    <div id="materials-list" class="materials-list">
      <p class="loading-message">正在加载课件列表...</p>
    </div>
  `;

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'materials',
    '课件下载',
    contentHtml
  );

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();

  console.log('XZZDPRO: 课件下载页面渲染完成，开始加载数据...');

  // Load coursewares
  loadAndRenderCoursewares(courseId);
}
