// lib/bulletinListBeautifier

import { suppressAirChatbot } from "@/shared/contentScripts/pageLifecycle"
import { createRoot } from "react-dom/client"
import { renderHeader, renderSidebar, setupThemeToggle, setupHelpModal, setupSidebarToggle, setupAvatarUpload } from "@/shared/layout"
import { setupAssistantNavigation } from "@/assistant/sidebar/navigation"
import { NotificationsPanel } from "./components"

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

  suppressAirChatbot()

  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'xzzdpro-root xzzdpro';

  root.innerHTML = `
    ${renderHeader({ username, showUsername: true })}

    ${renderSidebar({ currentPage: 'notification' })}

    <main class="xzzdpro-main">
      <div class="main-content-wrapper" id="notifications-mount-point"></div>
    </main>
  `;

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body', 'xzzdpro');

  setupThemeToggle();
  setupHelpModal();
  setupAvatarUpload();
  setupAssistantNavigation();
  setupSidebarToggle();

  console.log('XZZDPRO: 页面骨架渲染完成，挂载 React 组件...');

  mountNotificationsPanel();
}
