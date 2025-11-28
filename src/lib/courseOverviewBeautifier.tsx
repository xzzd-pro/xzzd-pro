// lib/courseOverviewBeautifier.tsx

import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle } from "./components/courseDetailHelpers"

export async function courseOverviewBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管课程概览页...');

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
    <p class="loading-message">正在加载课程概览...</p>
  `;

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'overview',
    '课程概览',
    contentHtml
  );

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();

  console.log('XZZDPRO: 课程概览页面渲染完成');
}
