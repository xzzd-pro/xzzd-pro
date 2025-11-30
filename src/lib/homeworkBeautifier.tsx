// lib/homeworkBeautifier.tsx

import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle, setupHelpModal, setupSidebarToggle } from "./components/courseDetailHelpers"
import type { HomeworkApiResponse, HomeworkActivity, ProcessedHomework, SubmissionListResponse, HomeworkSubmission } from "../types"

// Get user ID (similar to bulletinListBeautifier)
async function getUserId(): Promise<string | null> {
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

    const firstActivity = activityData.activity_reads[0];
    const userId = firstActivity.created_by_id || firstActivity.created_for_id;
    return userId ? String(userId) : null;
  } catch (error) {
    console.error('XZZDPRO: 获取用户ID时出错', error);
    return null;
  }
}

// Fetch homework list from API
async function fetchHomeworkList(courseId: string): Promise<HomeworkActivity[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/courses/${courseId}/homework-activities`
    );
    if (!response.ok) return [];
    const data: HomeworkApiResponse = await response.json();
    return data.homework_activities || [];
  } catch (error) {
    console.error('XZZDPRO: 获取作业列表时出错', error);
    return [];
  }
}

// Fetch submission list for a homework
async function fetchSubmissionList(activityId: number, userId: string): Promise<HomeworkSubmission[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/activities/${activityId}/students/${userId}/submission_list`
    );
    if (!response.ok) return [];
    const data: SubmissionListResponse = await response.json();
    return data.list || [];
  } catch (error) {
    console.error('XZZDPRO: 获取提交列表时出错', error);
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

// Process and sort homework list
function processHomeworks(homeworks: HomeworkActivity[], courseId: string): ProcessedHomework[] {
  const processed = homeworks.map(hw => ({
    id: hw.id,
    title: hw.title,
    score: hw.score,
    submitted: hw.submitted,
    isClosed: hw.is_closed,
    endTime: hw.end_time,
    deadline: new Date(hw.end_time),
    scorePublished: hw.score_published,
    link: `https://courses.zju.edu.cn/course/${courseId}/learning-activity#/${hw.id}`
  }));

  return processed.sort((a, b) => {
    if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
    if (!a.isClosed) return a.deadline.getTime() - b.deadline.getTime();
    return b.deadline.getTime() - a.deadline.getTime();
  });
}

// Format deadline display
function formatDeadline(deadline: Date, isClosed: boolean): string {
  if (isClosed) {
    return `已于 ${deadline.toLocaleDateString('zh-CN')} 截止`;
  }

  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `还剩 ${days} 天 ${hours} 小时`;
  if (hours > 0) {
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `还剩 ${hours} 小时 ${minutes} 分钟`;
  }
  return '即将截止';
}

// Upload file via background script (to bypass CORS)
async function uploadFile(file: File): Promise<number | null> {
  try {
    // Read file as ArrayBuffer
    const fileData = await file.arrayBuffer()

    // Send to background script
    const response = await chrome.runtime.sendMessage({
      type: 'UPLOAD_FILE',
      fileName: file.name,
      fileSize: file.size,
      fileData: fileData
    })

    if (response && response.success) {
      return response.uploadId
    } else {
      console.error('XZZDPRO: 上传失败', response?.error)
      return null
    }
  } catch (error) {
    console.error('XZZDPRO: 上传文件时出错', error)
    return null
  }
}

// Submit homework
async function submitHomework(activityId: number, uploadIds: number[]): Promise<boolean> {
  try {
    // Try direct submit without draft
    const response = await fetch(
      `https://courses.zju.edu.cn/api/course/activities/${activityId}/submissions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          comment: "",
          uploads: uploadIds,
          slides: [],
          is_draft: false,
          mode: "normal",
          other_resources: [],
          uploads_in_rich_text: []
        })
      }
    );

    if (!response.ok) {
      console.error('XZZDPRO: 提交作业失败');
      return false;
    }

    return true;
  } catch (error) {
    console.error('XZZDPRO: 提交作业时出错', error);
    return false;
  }
}

// Render homework list
function renderHomeworkList(homeworks: ProcessedHomework[], userId: string): string {
  if (homeworks.length === 0) {
    return '<p class="no-homework-message">暂无作业</p>';
  }

  return homeworks.map(hw => `
    <div class="homework-item ${hw.isClosed ? 'closed' : 'ongoing'}" data-homework-id="${hw.id}" data-user-id="${userId}">
      <div class="homework-header-wrapper">
        <div class="homework-expand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>
        <div class="homework-header-content">
          <div class="homework-header">
            <h3 class="homework-title">
              <a href="${hw.link}" class="homework-link">${hw.title}</a>
            </h3>
            <div class="homework-badges">
              ${hw.isClosed
                ? '<span class="badge badge-closed">已结束</span>'
                : '<span class="badge badge-ongoing">进行中</span>'
              }
              ${hw.submitted
                ? '<span class="badge badge-submitted">已提交</span>'
                : '<span class="badge badge-not-submitted">未提交</span>'
              }
            </div>
          </div>
          <div class="homework-meta">
            <div class="homework-deadline">
              <span class="meta-label">截止时间:</span>
              <span class="meta-value ${hw.isClosed ? '' : 'deadline-warning'}">${formatDeadline(hw.deadline, hw.isClosed)}</span>
            </div>
            ${hw.scorePublished && hw.submitted
              ? `<div class="homework-score">
                  <span class="meta-label">成绩:</span>
                  <span class="meta-value score-value">${hw.score}</span>
                </div>`
              : ''
            }
          </div>
        </div>
      </div>
      <div class="homework-expand-content">
        <div class="homework-submissions-section">
          <h4 class="submissions-title">已提交文件</h4>
          <div class="submissions-list" data-activity-id="${hw.id}">
            <p class="loading-message">点击展开加载...</p>
          </div>
        </div>
        ${!hw.isClosed ? `
        <div class="homework-upload-section">
          <h4 class="upload-title">上传作业</h4>
          <div class="upload-area" data-activity-id="${hw.id}">
            <div class="upload-dropzone">
              <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p class="upload-hint">拖拽文件到此处或点击选择文件</p>
              <input type="file" class="upload-input" multiple />
            </div>
            <div class="upload-file-list"></div>
            <button class="upload-submit-btn" disabled>提交作业</button>
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Render submission files
function renderSubmissionFiles(submissions: HomeworkSubmission[]): string {
  // Get the latest submission
  const latestSubmission = submissions.find(s => s.is_latest_version && s.marked_submitted);

  if (!latestSubmission || latestSubmission.uploads.length === 0) {
    return '<p class="no-submissions-message">暂无已提交文件</p>';
  }

  const submittedAt = new Date(latestSubmission.submitted_at).toLocaleString('zh-CN');

  return `
    <p class="submission-time">提交时间: ${submittedAt}</p>
    <div class="submitted-files">
      ${latestSubmission.uploads.map(upload => `
        <div class="submitted-file">
          <div class="file-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <div class="file-info">
            <div class="file-name">${upload.name}</div>
            <div class="file-size">${formatFileSize(upload.size)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Setup homework item handlers
function setupHomeworkHandlers(userId: string) {
  const homeworkItems = document.querySelectorAll('.homework-item');

  homeworkItems.forEach(item => {
    const headerWrapper = item.querySelector('.homework-header-wrapper');
    const activityId = item.getAttribute('data-homework-id');

    // Expand/collapse handler
    headerWrapper?.addEventListener('click', async (e) => {
      // Don't expand if clicking on the link
      if ((e.target as HTMLElement).closest('.homework-link')) return;

      item.classList.toggle('expanded');

      // Load submissions on first expand
      if (item.classList.contains('expanded')) {
        const submissionsList = item.querySelector('.submissions-list');
        if (submissionsList && submissionsList.innerHTML.includes('点击展开加载')) {
          submissionsList.innerHTML = '<p class="loading-message">正在加载...</p>';
          const submissions = await fetchSubmissionList(Number(activityId), userId);
          submissionsList.innerHTML = renderSubmissionFiles(submissions);
        }
      }
    });

    // Upload handlers (only for non-closed homework)
    const uploadArea = item.querySelector('.upload-area');
    if (uploadArea) {
      const dropzone = uploadArea.querySelector('.upload-dropzone') as HTMLElement;
      const fileInput = uploadArea.querySelector('.upload-input') as HTMLInputElement;
      const fileList = uploadArea.querySelector('.upload-file-list') as HTMLElement;
      const submitBtn = uploadArea.querySelector('.upload-submit-btn') as HTMLButtonElement;

      let selectedFiles: File[] = [];
      let uploadedIds: number[] = [];

      // Click to select files
      dropzone?.addEventListener('click', () => fileInput?.click());

      // File input change
      fileInput?.addEventListener('change', () => {
        if (fileInput.files) {
          selectedFiles = Array.from(fileInput.files);
          updateFileList();
        }
      });

      // Drag and drop
      dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer?.files) {
          selectedFiles = Array.from(e.dataTransfer.files);
          updateFileList();
        }
      });

      function updateFileList() {
        if (selectedFiles.length === 0) {
          fileList.innerHTML = '';
          submitBtn.disabled = true;
          return;
        }

        fileList.innerHTML = selectedFiles.map((file, index) => `
          <div class="upload-file-item" data-index="${index}">
            <span class="upload-file-name">${file.name}</span>
            <span class="upload-file-size">${formatFileSize(file.size)}</span>
            <button class="upload-file-remove" data-index="${index}">×</button>
          </div>
        `).join('');

        submitBtn.disabled = false;

        // Remove file handler
        fileList.querySelectorAll('.upload-file-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = Number((btn as HTMLElement).getAttribute('data-index'));
            selectedFiles.splice(index, 1);
            updateFileList();
          });
        });
      }

      // Submit button handler
      submitBtn?.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        submitBtn.disabled = true;
        submitBtn.textContent = '正在上传...';

        // Upload all files
        uploadedIds = [];
        for (const file of selectedFiles) {
          const uploadId = await uploadFile(file);
          if (uploadId) {
            uploadedIds.push(uploadId);
          }
        }

        if (uploadedIds.length === 0) {
          submitBtn.textContent = '上传失败，请重试';
          submitBtn.disabled = false;
          return;
        }

        submitBtn.textContent = '正在提交...';

        // Submit homework
        const success = await submitHomework(Number(activityId), uploadedIds);

        if (success) {
          submitBtn.textContent = '提交成功!';
          submitBtn.classList.add('success');
          selectedFiles = [];
          fileList.innerHTML = '';

          // Reload submissions
          const submissionsList = item.querySelector('.submissions-list');
          if (submissionsList) {
            submissionsList.innerHTML = '<p class="loading-message">正在刷新...</p>';
            const submissions = await fetchSubmissionList(Number(activityId), userId);
            submissionsList.innerHTML = renderSubmissionFiles(submissions);
          }

          // Update badge
          const notSubmittedBadge = item.querySelector('.badge-not-submitted');
          if (notSubmittedBadge) {
            notSubmittedBadge.className = 'badge badge-submitted';
            notSubmittedBadge.textContent = '已提交';
          }

          setTimeout(() => {
            submitBtn.textContent = '提交作业';
            submitBtn.classList.remove('success');
            submitBtn.disabled = true;
          }, 2000);
        } else {
          submitBtn.textContent = '提交失败，请重试';
          submitBtn.disabled = false;
        }
      });
    }
  });
}

// Load and render homework list
async function loadAndRenderHomework(courseId: string) {
  const container = document.querySelector('#homework-content');
  if (!container) return;

  container.innerHTML = '<p class="loading-message">正在加载作业列表...</p>';

  // Get user ID first
  const userId = await getUserId();
  if (!userId) {
    container.innerHTML = '<p class="error-message">无法获取用户信息</p>';
    return;
  }

  const homeworks = await fetchHomeworkList(courseId);
  const processed = processHomeworks(homeworks, courseId);

  container.innerHTML = renderHomeworkList(processed, userId);

  // Setup handlers after rendering
  setupHomeworkHandlers(userId);
}

export async function homeworkBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管作业页...');

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
    <div id="homework-content" class="homework-list">
      <p class="loading-message">正在加载作业信息...</p>
    </div>
  `;

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'homework',
    '作业提交',
    contentHtml
  );

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();
  setupHelpModal();
  setupSidebarToggle();

  console.log('XZZDPRO: 作业页面渲染完成，开始加载数据...');

  loadAndRenderHomework(courseId);
}
