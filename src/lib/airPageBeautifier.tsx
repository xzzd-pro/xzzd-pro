
import { Storage } from "@plasmohq/storage"
import {
  renderHeader,
  renderSidebar,
  setupThemeToggle,
  setupHelpModal,
  setupSidebarToggle,
  setupAssistantNavigation
} from "./components/layoutHelpers";
import { setupResizeHandlers, applySavedLayout } from "./components/resizeHandlers";
import { createAssistantHost } from "./assistantBeautifier";

const storage = new Storage();

export async function mountAirPage() {
  // 1. Clear existing body content and reset styles
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.height = '100vh';
  document.body.style.overflow = 'hidden';

  // 2. Render standard layout skeleton
  // Using the same structure as standard pages
  const root = document.createElement('div');
  root.id = 'xzzdpro-root';
  root.className = 'xzzdpro-root';
  root.innerHTML = `
    ${renderHeader({ username: '', showUsername: false })}
    ${renderSidebar({ currentPage: 'assistant' })}
    
    <main class="xzzdpro-main">
      <div class="content-area" id="main-content-area" style="overflow: hidden; display: flex; flex-direction: column; height: 100%;">
        <!-- Assistant Host will be injected here -->
      </div>
    </main>
  `;

  document.body.appendChild(root);
  document.body.classList.add('xzzdpro-body');
  document.documentElement.classList.add('xzzdpro');

  console.log('XZZDPRO: Air Page Layout rendered');

  // 3. Mount Assistant Host into Content Area
  const contentArea = document.getElementById('main-content-area');
  if (contentArea) {
    try {
      const assistantHost = await createAssistantHost();
      contentArea.appendChild(assistantHost);
      console.log('XZZDPRO: Assistant Host embedded into Air Page');
    } catch (error) {
      console.error('XZZDPRO: Failed to embed assistant', error);
      contentArea.innerHTML = `<div style="padding: 20px; color: red;">Failed to load assistant: ${String(error)}</div>`;
    }
  }

  // 4. Initialize standard layout interactions
  setupThemeToggle();
  setupHelpModal();
  setupSidebarToggle();
  setupAssistantNavigation();

  // 5. Initialize resize handlers
  await applySavedLayout();
  setupResizeHandlers();
  console.log('XZZDPRO: Air Page Logic Initialized');
}
