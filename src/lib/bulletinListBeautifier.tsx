// lib/bulletinListBeautifier

import { Storage } from "@plasmohq/storage"
import { createThemeToggle } from "./components/themeToggle"
import { navIcons } from "./components/navIcons"
import type { ApiNotificationData, NotificationType, ProcessedNotification } from "../types"

const $ = (selector: string): HTMLElement | null => document.querySelector(selector);
const $$ = (selector: string): NodeListOf<HTMLElement> => document.querySelectorAll(selector);

const NOTIFICATION_TYPE_NAMES: Record<string, string> = {
  'activity_opened': '新文件发布',
  'homework_opened_for_submission': '新作业发布',
  'homework_score_updated': '作业成绩发布',
  'exam_will_start': '测验即将开始',
  'exam_submit_started': '测验已开始'
};

const VALID_TYPES = [
  'activity_opened',
  'homework_opened_for_submission',
  'homework_score_updated',
  'exam_will_start',
  'exam_submit_started'
];

// Get user ID by fetching course activity data
async function getUserId(): Promise<string | null> {
  try {
    // First, get a course ID from the user's courses
    const coursesResponse = await fetch('https://courses.zju.edu.cn/api/my-courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
      console.error('XZZDPRO: 获取课程列表失败', coursesResponse.status);
      return null;
    }

    const coursesData = await coursesResponse.json();

    if (!coursesData.courses || coursesData.courses.length === 0) {
      console.error('XZZDPRO: 没有找到任何课程');
      return null;
    }

    // Get the first course ID
    const courseId = coursesData.courses[0].id;
    console.log('XZZDPRO: 使用课程ID获取用户ID', courseId);

    // Fetch activity data to get user ID
    const activityResponse = await fetch(
      `https://courses.zju.edu.cn/api/course/${courseId}/activity-reads-for-user`
    );

    if (!activityResponse.ok) {
      console.error('XZZDPRO: 获取用户ID失败', activityResponse.status);
      return null;
    }

    const activityData = await activityResponse.json();
    console.log('XZZDPRO: 活动数据', activityData);

    // The response contains an activity_reads array
    if (!activityData.activity_reads || activityData.activity_reads.length === 0) {
      console.error('XZZDPRO: 没有找到活动数据');
      return null;
    }

    // Extract user ID from the first activity read
    const firstActivity = activityData.activity_reads[0];
    const userId = firstActivity.created_by_id || firstActivity.created_for_id;
    console.log('XZZDPRO: 提取到的用户ID', userId);

    if (!userId) {
      console.error('XZZDPRO: 无法从活动数据中提取用户ID');
      return null;
    }

    return String(userId);
  } catch (error) {
    console.error('XZZDPRO: 获取用户ID时出错', error);
    return null;
  }
}

async function fetchNotifications(userId: string, offset: number = 0, limit: number = 100): Promise<ApiNotificationData[]> {
  try {
    const url = `https://courses.zju.edu.cn/ntf/users/${userId}/notifications?offset=${offset}&limit=${limit}&removed=only_mobile&additionalFields=total_count`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error('XZZDPRO: 公告API请求失败', response.status);
      return [];
    }

    const data = await response.json();

    if (data.notifications && Array.isArray(data.notifications)) {
      return data.notifications;
    }

    console.warn('XZZDPRO: 未找到预期的公告数据结构', data);
    return [];
  } catch (error) {
    console.error('XZZDPRO: 公告网络请求出错', error);
    return [];
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  }
}

function generateNotificationLink(notification: ApiNotificationData): string {
  const { payload } = notification;

  if (payload.activity_id && payload.course_id) {
    return `https://courses.zju.edu.cn/course/${payload.course_id}/learning-activity#/${payload.activity_id}`;
  } else if (payload.homework_id && payload.course_id) {
    return `https://courses.zju.edu.cn/course/${payload.course_id}/learning-activity#/${payload.homework_id}`;
  } else if (payload.exam_id && payload.course_id) {
    return `https://courses.zju.edu.cn/course/${payload.course_id}/learning-activity#/${payload.exam_id}`;
  } else if (payload.course_id) {
    return `https://courses.zju.edu.cn/course/${payload.course_id}`;
  }

  return '#';
}

function processNotification(notification: ApiNotificationData): ProcessedNotification | null {
  // Filter out invalid types
  if (!VALID_TYPES.includes(notification.type)) {
    return null;
  }

  const { payload } = notification;
  let title = '';

  if (payload.activity_title) {
    title = payload.activity_title;
  } else if (payload.homework_title) {
    title = payload.homework_title;
  } else if (payload.exam_title) {
    title = payload.exam_title;
  } else {
    title = '未知通知';
  }

  return {
    id: notification.id,
    type: notification.type as NotificationType,
    title,
    courseName: payload.course_name,
    time: formatTime(notification.timestamp),
    link: generateNotificationLink(notification),
    read: notification.read || false,
    score: payload.score
  };
}

function getLoadingHtml(text: string = '加载中...'): string {
  return `
    <div class="xzzd-loading-state">
      <span class="spinner">⏳</span> ${text}
    </div>
  `;
}

let currentUnreadFilter: string = 'all';
let currentReadFilter: string = 'all';
let allNotifications: ProcessedNotification[] = [];

function renderNotifications(notifications: ProcessedNotification[], containerId: string, filterType: string) {
  const container = $(`#${containerId}`);
  if (!container) return;

  let filtered = notifications;
  if (filterType !== 'all') {
    filtered = notifications.filter(n => n.type === filterType);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p class="no-notifications-message">暂无公告</p>';
    return;
  }

  const notificationsHtml = filtered.map(notification => {
    const typeName = NOTIFICATION_TYPE_NAMES[notification.type] || notification.type;

    // Determine score class based on score value
    let scoreClass = '';
    let scoreText = '';
    if (notification.score !== undefined && notification.score !== null) {
      const score = parseFloat(notification.score);
      if (!isNaN(score)) {
        if (score >= 90) { scoreClass = 'score-excellent'; scoreText = `${notification.score} 分`; }
        else if (score >= 80) { scoreClass = 'score-good'; scoreText = `${notification.score} 分`; }
        else if (score >= 70) { scoreClass = 'score-medium'; scoreText = `${notification.score} 分`; }
        else if (score >= 60) { scoreClass = 'score-pass'; scoreText = `${notification.score} 分`; }
        else { scoreClass = 'score-fail'; scoreText = `${notification.score} 分`; }
      }
    }

    return `
      <a href="${notification.link}" class="notification-item">
        <div class="notification-header">
          <span class="notification-type-badge">${typeName}</span>
          <span class="notification-time">${notification.time}</span>
        </div>
        <div class="notification-title">${notification.title}</div>
        <div class="notification-footer">
          <span class="notification-course">${notification.courseName}</span>
          ${scoreText ? `<span class="notification-score ${scoreClass}">${scoreText}</span>` : ''}
        </div>
      </a>
    `;
  }).join('');

  container.innerHTML = notificationsHtml;
}

function setupFilterHandlers() {
  // Unread filter buttons
  const unreadFilterBtns = $$('.unread-filter-btn');
  unreadFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filterType = btn.getAttribute('data-type') || 'all';
      currentUnreadFilter = filterType;

      // Update active state
      unreadFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Re-render unread notifications
      const unreadNotifications = allNotifications.filter(n => !n.read);
      renderNotifications(unreadNotifications, 'unread-notifications-container', currentUnreadFilter);
    });
  });

  // Read filter buttons
  const readFilterBtns = $$('.read-filter-btn');
  readFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filterType = btn.getAttribute('data-type') || 'all';
      currentReadFilter = filterType;

      // Update active state
      readFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Re-render read notifications
      const readNotifications = allNotifications.filter(n => n.read);
      renderNotifications(readNotifications, 'read-notifications-container', currentReadFilter);
    });
  });
}

function updateNotificationCounts() {
  // Count unread notifications by type
  const unreadNotifications = allNotifications.filter(n => !n.read);
  const readNotifications = allNotifications.filter(n => n.read);

  const unreadCounts = {
    all: unreadNotifications.length,
    activity_opened: unreadNotifications.filter(n => n.type === 'activity_opened').length,
    homework_opened_for_submission: unreadNotifications.filter(n => n.type === 'homework_opened_for_submission').length,
    homework_score_updated: unreadNotifications.filter(n => n.type === 'homework_score_updated').length,
    exam_will_start: unreadNotifications.filter(n => n.type === 'exam_will_start' || n.type === 'exam_submit_started').length,
  };

  const readCounts = {
    all: readNotifications.length,
    activity_opened: readNotifications.filter(n => n.type === 'activity_opened').length,
    homework_opened_for_submission: readNotifications.filter(n => n.type === 'homework_opened_for_submission').length,
    homework_score_updated: readNotifications.filter(n => n.type === 'homework_score_updated').length,
    exam_will_start: readNotifications.filter(n => n.type === 'exam_will_start' || n.type === 'exam_submit_started').length,
  };

  // Update unread badges
  $$('.unread-filter-btn').forEach(btn => {
    const type = btn.getAttribute('data-type') || 'all';
    const badge = btn.querySelector('.badge') as HTMLElement | null;
    if (badge) {
      const count = unreadCounts[type as keyof typeof unreadCounts] || 0;
      badge.textContent = String(count);
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  });

  // Update read badges
  $$('.read-filter-btn').forEach(btn => {
    const type = btn.getAttribute('data-type') || 'all';
    const badge = btn.querySelector('.badge') as HTMLElement | null;
    if (badge) {
      const count = readCounts[type as keyof typeof readCounts] || 0;
      badge.textContent = String(count);
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  });
}

async function loadAndRenderNotifications() {
  const userId = await getUserId();
  if (!userId) {
    console.error('XZZDPRO: 无法获取用户ID');
    return;
  }

  const unreadContainer = $('#unread-notifications-container');
  const readContainer = $('#read-notifications-container');

  if (unreadContainer) unreadContainer.innerHTML = getLoadingHtml('正在加载未读公告...');
  if (readContainer) readContainer.innerHTML = getLoadingHtml('正在加载已读公告...');

  let rawNotifications: ApiNotificationData[] = [];
  try {
    rawNotifications = await fetchNotifications(userId);
  } catch (e) {
    console.warn('XZZDPRO: 获取公告异常', e);
  }

  // Process and filter notifications
  allNotifications = rawNotifications
    .map(processNotification)
    .filter((n): n is ProcessedNotification => n !== null);

  const unreadNotifications = allNotifications.filter(n => !n.read);
  const readNotifications = allNotifications.filter(n => n.read);

  renderNotifications(unreadNotifications, 'unread-notifications-container', currentUnreadFilter);
  renderNotifications(readNotifications, 'read-notifications-container', currentReadFilter);

  // Update notification counts on badges
  updateNotificationCounts();
}

export function bulletinListBeautifier(): void {
  console.log('XZZDPRO: 准备接管公告页...');

  const usernameElement = $('#userCurrentName');
  const username = usernameElement ? usernameElement.textContent.trim() : '同学';
  const logoSrc = 'https://courses.zju.edu.cn/api/uploads/57/modified-image?thumbnail=0x272';

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
            <span class="nav-icon">${navIcons.home}</span><span class="nav-text">主页</span>
          </a>
        </li>
        <li class="nav-item">
          <a href="https://courses.zju.edu.cn/bulletin-list/#/" class="nav-link">
           <span class="nav-icon">${navIcons.notification}</span><span class="nav-text">动态</span>
          </a>
        </li>
        <li class="nav-item">
          <a href="https://courses.zju.edu.cn/user/courses#/" class="nav-link">
            <span class="nav-icon">${navIcons.courses}</span><span class="nav-text">课程</span>
          </a>
        </li>
        <li class="nav-item">
           <a href="#" class="nav-link"><span class="nav-icon">${navIcons.assistant}</span><span class="nav-text">学习助理</span></a>
        </li>
      </ul>
    </nav>

    <main class="xzzdpro-main">
      <div class="widget-card notifications-card">
        <h3>未读公告</h3>
        <div class="filter-tabs">
          <button class="filter-btn unread-filter-btn active" data-type="all">
            全部
            <span class="badge">0</span>
          </button>
          <button class="filter-btn unread-filter-btn" data-type="activity_opened">
            新文件
            <span class="badge">0</span>
          </button>
          <button class="filter-btn unread-filter-btn" data-type="homework_opened_for_submission">
            新作业
            <span class="badge">0</span>
          </button>
          <button class="filter-btn unread-filter-btn" data-type="homework_score_updated">
            作业成绩
            <span class="badge">0</span>
          </button>
          <button class="filter-btn unread-filter-btn" data-type="exam_will_start">
            测验开始
            <span class="badge">0</span>
          </button>
        </div>
        <div class="notifications-container" id="unread-notifications-container">
          ${getLoadingHtml('正在加载未读公告...')}
        </div>
      </div>

      <div class="widget-card notifications-card">
        <h3>已读公告</h3>
        <div class="filter-tabs">
          <button class="filter-btn read-filter-btn active" data-type="all">
            全部
            <span class="badge">0</span>
          </button>
          <button class="filter-btn read-filter-btn" data-type="activity_opened">
            新文件
            <span class="badge">0</span>
          </button>
          <button class="filter-btn read-filter-btn" data-type="homework_opened_for_submission">
            新作业
            <span class="badge">0</span>
          </button>
          <button class="filter-btn read-filter-btn" data-type="homework_score_updated">
            作业成绩
            <span class="badge">0</span>
          </button>
          <button class="filter-btn read-filter-btn" data-type="exam_will_start">
            测验开始
            <span class="badge">0</span>
          </button>
        </div>
        <div class="notifications-container" id="read-notifications-container">
          ${getLoadingHtml('正在加载已读公告...')}
        </div>
      </div>
    </main>
  `;

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  themeToggle.setup();
  setupFilterHandlers();

  console.log('XZZDPRO: 页面骨架渲染完成，开始异步加载数据...');

  loadAndRenderNotifications();
}
