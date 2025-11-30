// lib/forumBeautifier.tsx

import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle, setupHelpModal, setupSidebarToggle } from "./components/courseDetailHelpers"
import type { TopicCategoriesResponse, TopicCategory, CategoryDetailResponse, Topic, ProcessedCategory } from "../types"

// Fetch topic categories (discussion areas)
async function fetchTopicCategories(courseId: string): Promise<TopicCategory[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/courses/${courseId}/topic-categories`
    );
    if (!response.ok) return [];
    const data: TopicCategoriesResponse = await response.json();
    return data.topic_categories || [];
  } catch (error) {
    console.error('XZZDPRO: 获取讨论区列表时出错', error);
    return [];
  }
}

// Fetch topics for a specific category
async function fetchCategoryTopics(categoryId: number): Promise<Topic[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/forum/categories/${categoryId}`
    );
    if (!response.ok) return [];
    const data: CategoryDetailResponse = await response.json();
    return data.result?.topics || [];
  } catch (error) {
    console.error('XZZDPRO: 获取讨论帖子时出错', error);
    return [];
  }
}

// Process categories for display
function processCategories(categories: TopicCategory[]): ProcessedCategory[] {
  return categories.map(cat => ({
    id: cat.id,
    title: cat.title || '默认讨论区',
    topicCount: cat.topics_and_replies_count,
    unreadCount: cat.category_unread_topic_count + cat.category_unread_reply_count
  }));
}

// Format date display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;

  return date.toLocaleDateString('zh-CN');
}

// Render category list
function renderCategoryList(categories: ProcessedCategory[], courseId: string): string {
  if (categories.length === 0) {
    return '<p class="no-forum-message">暂无讨论区</p>';
  }

  return `
    <div class="forum-categories">
      ${categories.map(cat => `
        <div class="forum-category-item" data-category-id="${cat.id}">
          <div class="category-header-wrapper">
            <div class="category-expand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </div>
            <div class="category-header-content">
              <div class="category-header">
                <h3 class="category-title">${cat.title}</h3>
                <div class="category-badges">
                  ${cat.unreadCount > 0 ? `<span class="badge badge-unread">${cat.unreadCount} 条未读</span>` : ''}
                  <span class="badge badge-count">${cat.topicCount} 条讨论</span>
                </div>
              </div>
            </div>
          </div>
          <div class="category-expand-content">
            <div class="category-topics-section">
              <div class="topics-list" data-category-id="${cat.id}">
                <p class="loading-message">点击展开加载帖子...</p>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Render topics for a category
function renderTopics(topics: Topic[], courseId: string): string {
  if (topics.length === 0) {
    return '<p class="no-topics-message">暂无帖子</p>';
  }

  return `
    <div class="topics-container">
      ${topics.map(topic => `
        <div class="topic-item ${topic.is_top ? 'is-top' : ''} ${topic.is_digest ? 'is-digest' : ''}">
          <div class="topic-main">
            <div class="topic-header">
              <a href="https://courses.zju.edu.cn/course/${courseId}/forum#/topic/${topic.id}"
                 class="topic-title-link" target="_blank">
                ${topic.is_top ? '<span class="topic-tag tag-top">置顶</span>' : ''}
                ${topic.is_digest ? '<span class="topic-tag tag-digest">精华</span>' : ''}
                <span class="topic-title">${topic.title}</span>
              </a>
            </div>
            <div class="topic-meta">
              <span class="topic-author">${topic.author?.name || '匿名用户'}</span>
              <span class="topic-time">${formatDate(topic.created_at)}</span>
            </div>
          </div>
          <div class="topic-stats">
            <span class="stat-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="stat-icon">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span class="stat-value">${topic.reply_count || 0}</span>
            </span>
            <span class="stat-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="stat-icon">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
              <span class="stat-value">${topic.like_count || 0}</span>
            </span>
            ${topic.instructor_replied ? `
              <span class="stat-item instructor-replied">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="stat-icon">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
                <span class="stat-value">教师已回复</span>
              </span>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Setup category item handlers
function setupCategoryHandlers(courseId: string) {
  const categoryItems = document.querySelectorAll('.forum-category-item');

  categoryItems.forEach(item => {
    const headerWrapper = item.querySelector('.category-header-wrapper');
    const categoryId = item.getAttribute('data-category-id');

    // Expand/collapse handler
    headerWrapper?.addEventListener('click', async () => {
      item.classList.toggle('expanded');

      // Load topics on first expand
      if (item.classList.contains('expanded')) {
        const topicsList = item.querySelector('.topics-list');
        if (topicsList && topicsList.innerHTML.includes('点击展开加载')) {
          topicsList.innerHTML = '<p class="loading-message">正在加载帖子...</p>';
          const topics = await fetchCategoryTopics(Number(categoryId));
          topicsList.innerHTML = renderTopics(topics, courseId);
        }
      }
    });
  });
}

// Load and render forum
async function loadAndRenderForum(courseId: string) {
  const container = document.querySelector('#forum-content');
  if (!container) return;

  container.innerHTML = '<p class="loading-message">正在加载讨论区...</p>';

  const categories = await fetchTopicCategories(courseId);
  const processed = processCategories(categories);

  container.innerHTML = renderCategoryList(processed, courseId);

  // Setup handlers after rendering
  setupCategoryHandlers(courseId);
}

export async function forumBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管讨论区页...');

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
    <div id="forum-content" class="forum-list">
      <p class="loading-message">正在加载讨论区...</p>
    </div>
  `;

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'discussion',
    '💬 讨论区',
    contentHtml
  );

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();
  setupHelpModal();
  setupSidebarToggle();

  console.log('XZZDPRO: 讨论区页面渲染完成，开始加载数据...');

  loadAndRenderForum(courseId);
}
