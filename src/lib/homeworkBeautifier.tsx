// lib/homeworkBeautifier.tsx

import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle } from "./components/courseDetailHelpers"
import type { HomeworkApiResponse, HomeworkActivity, ProcessedHomework } from "../types"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

// Fetch homework list from API
async function fetchHomeworkList(courseId: string): Promise<HomeworkActivity[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/courses/${courseId}/homework-activities`
    );

    if (!response.ok) {
      console.error('XZZDPRO: 获取作业列表失败', response.status);
      return [];
    }

    const data: HomeworkApiResponse = await response.json();
    return data.homework_activities || [];
  } catch (error) {
    console.error('XZZDPRO: 获取作业列表时出错', error);
    return [];
  }
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

  // Sort: ongoing first (by end time ascending), then closed (by end time descending)
  return processed.sort((a, b) => {
    if (a.isClosed !== b.isClosed) {
      return a.isClosed ? 1 : -1; // Ongoing first
    }

    if (!a.isClosed) {
      // For ongoing homework, sort by end time (earliest first)
      return a.deadline.getTime() - b.deadline.getTime();
    } else {
      // For closed homework, sort by end time (latest first)
      return b.deadline.getTime() - a.deadline.getTime();
    }
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

  if (days > 0) {
    return `还剩 ${days} 天 ${hours} 小时`;
  } else if (hours > 0) {
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `还剩 ${hours} 小时 ${minutes} 分钟`;
  } else {
    return '即将截止';
  }
}

// Render homework list
function renderHomeworkList(homeworks: ProcessedHomework[]): string {
  if (homeworks.length === 0) {
    return '<p class="no-homework-message">暂无作业</p>';
  }

  return homeworks.map(hw => `
    <div class="homework-item ${hw.isClosed ? 'closed' : 'ongoing'}">
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
  `).join('');
}

// Load and render homework list
async function loadAndRenderHomework(courseId: string, activityId?: string) {
  const container = document.querySelector('#homework-content');
  if (!container) return;

  container.innerHTML = '<p class="loading-message">正在加载作业列表...</p>';

  const homeworks = await fetchHomeworkList(courseId);
  const processed = processHomeworks(homeworks, courseId);

  container.innerHTML = renderHomeworkList(processed);
}

export async function homeworkBeautifier(activityId?: string): Promise<void> {
  console.log('XZZDPRO: 准备接管作业页...', activityId ? `活动ID: ${activityId}` : '');

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

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root';

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

  console.log('XZZDPRO: 作业页面渲染完成，开始加载数据...');

  // Load homework list
  loadAndRenderHomework(courseId, activityId);
}
