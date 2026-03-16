// lib/examBeautifier.tsx

import { getCourseIdFromUrl, getCourseName, renderCourseDetailPage, setupThemeToggle, setupHelpModal, setupSidebarToggle, setupAvatarUpload } from "./components/courseDetailHelpers"

export async function examBeautifier(): Promise<void> {
  console.log('XZZDPRO: 准备接管小测页...');

  // 移除 chatbot 并监视动态添加
  const removeChatbot = () => {
    document.querySelectorAll('air-chatbot-app').forEach(el => el.remove());
  };
  removeChatbot();

  const observer = new MutationObserver(() => {
    removeChatbot();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 5秒后停止监视
  setTimeout(() => observer.disconnect(), 5000);

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root xzzdpro';

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
  document.body.classList.add('xzzdpro-body', 'xzzdpro');

  setupThemeToggle();
  setupHelpModal();
  setupAvatarUpload();
  setupSidebarToggle();

  console.log('XZZDPRO: 小测页面渲染完成');
}
