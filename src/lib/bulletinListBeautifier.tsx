// lib/bulletinListBeautifier

import { createRoot } from "react-dom/client"
import { renderHeader, renderSidebar, setupThemeToggle, setupHelpModal, setupSidebarToggle, setupAssistantNavigation, setupAvatarUpload } from "./components/layoutHelpers"
import { NotificationsPanel } from "../components/bulletin"

const $ = (selector: string): HTMLElement | null => document.querySelector(selector);

function mountNotificationsPanel(): void {
  const mountPoint = document.getElementById('notifications-mount-point');
  if (!mountPoint) {
    console.error('XZZDPRO: 找不到 React 挂载点');
    return;
  }

  const root = createRoot(mountPoint);
  root.render(<NotificationsPanel />);
  console.log('XZZDPRO: React 组件已挂载');
}

export function bulletinListBeautifier(): void {
  console.log('XZZDPRO: 准备接管公告页...');

  const usernameElement = $('#userCurrentName');
  const username = usernameElement?.textContent?.trim() ?? '';

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
  root.className = 'xzzdpro-root';

  root.innerHTML = `
    ${renderHeader({ username, showUsername: true })}

    ${renderSidebar({ currentPage: 'notification' })}

    <main class="xzzdpro-main">
      <div class="main-content-wrapper" id="notifications-mount-point"></div>
    </main>
  `;

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');

  setupThemeToggle();
  setupHelpModal();
  setupAvatarUpload();
  setupAssistantNavigation();
  setupSidebarToggle();

  console.log('XZZDPRO: 页面骨架渲染完成，挂载 React 组件...');

  mountNotificationsPanel();
}
