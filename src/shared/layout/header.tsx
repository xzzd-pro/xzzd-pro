import { createThemeToggle } from "./ThemeToggle"
import { createRoot } from "react-dom/client"
import React from "react"
import { AvatarUpload } from "@/components/ui/avatar-upload"
import { bindLayoutControl } from "./bindings"

const LOGO_SRC = 'https://courses.zju.edu.cn/api/uploads/57/modified-image?thumbnail=0x272';

interface HeaderOptions {
  username?: string;
  showUsername?: boolean;
}

export function renderHeader(options: HeaderOptions = {}): string {
  const { username = '', showUsername = true } = options;
  const themeToggle = createThemeToggle();

  return `
    <header class="xzzdpro-header">
      <div class="logo-area">
        ${LOGO_SRC ? `<a href="https://courses.zju.edu.cn/user/index#/" class="logo-link"><img src="${LOGO_SRC}" alt="Logo"></a>` : '<a href="https://courses.zju.edu.cn/user/index#/" class="logo-link">Logo 区域</a>'}
        <button class="help-btn" id="help-btn" title="使用须知">
          <span>使用须知</span>
        </button>
      </div>
      <div class="right-section">
        ${themeToggle.renderHTML()}
        <div class="user-profile">
          <div id="user-avatar-container" class="user-avatar-container"></div>
          ${showUsername && username ? `<span class="username">${username}</span>` : ''}
        </div>
      </div>
    </header>

    <!-- 使用须知模态框 -->
    <div class="modal-overlay" id="help-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>使用须知</h3>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p><strong>欢迎使用 XZZDPRO 学在浙大美化插件！</strong></p>
          <ul>
            <li>本项目为学在浙大页面美化插件，在本地运行，不会向开发者上传个人数据。</li>
            <li>所有课程信息、通知及相关内容，均以学在浙大原生页面为准。</li>
            <li>目前课程详情页仅支持课件下载、作业提交和成绩查看。</li>
            <li>Chrome / Edge 用户请将插件固定到浏览器顶部工具栏，可随时通过插件图标关闭美化功能。</li>
          </ul>
          <p><strong>如有问题或建议，欢迎反馈！</strong></p>
        </div>
      </div>
    </div>
  `;
}

export function setupThemeToggle(): void {
  const themeToggle = createThemeToggle();
  themeToggle.setup();
}

/**
 * Setup help modal functionality
 * Should be called after the header HTML is added to the DOM
 */
export function setupHelpModal(): void {
  const helpBtn = document.getElementById('help-btn');
  const modal = document.getElementById('help-modal');
  const closeBtn = document.getElementById('modal-close');

  if (!helpBtn || !modal || !closeBtn) return;
  const binding = bindLayoutControl('help-modal', modal);
  if (!binding) return;
  const { signal } = binding;

  helpBtn.addEventListener('click', () => {
    modal.classList.add('active');
  }, { signal });

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  }, { signal });

  // 点击遮罩层关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  }, { signal });

  // ESC 键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
    }
  }, { signal });
}

export function setupAvatarUpload(): void {
  const container = document.getElementById('user-avatar-container');
  if (!container) return;
  const binding = bindLayoutControl('avatar', container);
  if (!binding) return;

  const root = createRoot(container);
  binding.onCleanup(() => root.unmount());
  root.render(React.createElement(AvatarUpload, {
    size: 'lg',
    fallback: 'U',
    className: 'user-avatar'
  }));
}
