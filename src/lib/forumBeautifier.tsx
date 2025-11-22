// lib/forumBeautifier.tsx

import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle } from "./components/courseDetailHelpers"

export async function forumBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管讨论区页...');

  const courseId = getCourseIdFromUrl();
  if (!courseId) {
    console.error('XZZDPRO: 无法提取课程ID');
    return;
  }

  const courseName = await getCourseName();

  const contentHtml = `
    <p class="loading-message">正在加载讨论区...</p>
  `;

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root';

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

  console.log('XZZDPRO: 讨论区页面渲染完成');
}
