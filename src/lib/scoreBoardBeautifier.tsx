// lib/scoreBoardBeautifier.tsx

import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle } from "./components/courseDetailHelpers"

export async function scoreBoardBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管成绩页...');

  const courseId = getCourseIdFromUrl();
  if (!courseId) {
    console.error('XZZDPRO: 无法提取课程ID');
    return;
  }

  const courseName = await getCourseName();

  const contentHtml = `
    <p class="loading-message">正在加载成绩...</p>
  `;

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root';

  root.innerHTML = renderCourseDetailPage(
    courseId,
    courseName,
    'grades',
    '📊 成绩',
    contentHtml
  );

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();

  console.log('XZZDPRO: 成绩页面渲染完成');
}
