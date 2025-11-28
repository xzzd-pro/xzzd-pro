// lib/examBeautifier.tsx

import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle } from "./components/courseDetailHelpers"

export async function examBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管小测页...');

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
    <p class="loading-message">正在加载小测列表...</p>
  `;

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'quiz',
    '📝 小测',
    contentHtml
  );

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();

  console.log('XZZDPRO: 小测页面渲染完成');
}
