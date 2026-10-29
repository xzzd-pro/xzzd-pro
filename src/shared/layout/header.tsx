import { escapeHtml } from "@/lib/html"

import { bindLayoutControl } from "./bindings"
import { createThemeToggle } from "./theme-toggle"

const LOGO_SRC =
  "https://courses.zju.edu.cn/api/uploads/57/modified-image?thumbnail=0x272"

// Empty outside the extension (tests, the local preview).
function getExtensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version || ""
  } catch {
    return ""
  }
}

interface HeaderOptions {
  username?: string
  showUsername?: boolean
}

/**
 * Renders the extension header with logo, help, background picker and theme toggle.
 * @param options Username and whether to show it.
 * @returns HTML string.
 */
export function renderHeader(options: HeaderOptions = {}): string {
  const { username = "", showUsername = true } = options
  const themeToggle = createThemeToggle()
  const version = getExtensionVersion()

  return `
    <header class="xzzdpro-header">
      <div class="logo-area">
        ${LOGO_SRC ? `<a href="https://courses.zju.edu.cn/user/index#/" class="logo-link"><img src="${LOGO_SRC}" alt="Logo"></a>` : '<a href="https://courses.zju.edu.cn/user/index#/" class="logo-link">Logo 区域</a>'}
        <button type="button" class="help-btn" id="help-btn" title="使用须知" aria-haspopup="dialog">
          <span>使用须知</span>
        </button>
      </div>
      <div class="right-section">
        <div id="page-background-picker" class="page-background-picker"></div>
        ${themeToggle.renderHTML()}
        ${showUsername && username ? `<span class="username">${escapeHtml(username)}</span>` : ""}
      </div>
    </header>

    <!-- Help dialog -->
    <div class="modal-overlay" id="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="help-modal-title">使用须知</h3>
          <button type="button" class="modal-close" id="modal-close" aria-label="关闭">&times;</button>
        </div>
        <div class="modal-body">
          <p><strong>欢迎使用 XZZD-Pro！</strong>本项目作为浏览器插件，仅用于美化学在浙大页面，课程、通知等内容请以学在浙大原页面为准。</p>
          <p><strong>功能和一些建议</strong></p>
          <ul>
            <li>为了让页面更简洁，我们舍弃了绝大多数课程用不到的部分，只保留最常用的功能；需要其他功能时，可点击扩展图标关闭美化，回到学在浙大原页面。</li>
            <li>课程详情页支持课程概览、课件批量下载、作业提交和成绩查看。为保证小测安全，点击“小测”会回到学在浙大原页面作答。</li>
            <li>右上角可切换深浅色主题，或设置页面背景色和背景图片；背景图片只保存在本机。</li>
            <li>可将扩展固定到浏览器工具栏，随时点击扩展图标关闭美化。</li>
          </ul>
          <p><strong>学习助理与数据处理</strong></p>
          <ul>
            <li>学习助理会把课程名、课件内容（文字或页面图片）、对话记录和你上传的附件，从浏览器直接发送给你在设置中选择的 AI 服务商，由该服务商按其规则处理。</li>
            <li>没有勾选资料时，会发送整门课的全部资料；只想用部分资料，请先在侧边栏“资料选择”中勾选。</li>
            <li>不会发送你的姓名、学号、成绩、作业提交记录或学在浙大登录信息。API Key 保存在本机，只用于向该服务商发送请求。</li>
            <li>除学习助理外，扩展不会上传任何数据，开发者也收不到你的数据。</li>
          </ul>
          <p>遇到问题或有建议，欢迎到 <a href="https://github.com/xzzd-pro/xzzd-pro/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a> 反馈${version ? `（当前版本 v${escapeHtml(version)}）` : ""}。</p>
          <p>主要开发者：<a href="https://github.com/RanderDouble" target="_blank" rel="noopener noreferrer">RanderDouble</a>、<a href="https://github.com/Ch3ngJY" target="_blank" rel="noopener noreferrer">Ch3ngJY</a>、<a href="https://github.com/NoughtQ" target="_blank" rel="noopener noreferrer">NoughtQ</a></p>
        </div>
      </div>
    </div>
  `
}

/**
 * Binds the header's theme toggle button.
 */
export function setupThemeToggle(): void {
  const themeToggle = createThemeToggle()
  themeToggle.setup()
}

/**
 * Binds the help dialog: open from the header button, close with the close
 * button, the backdrop or Escape. Focus moves into the dialog on open and
 * back to the help button on close. Call after the header is in the DOM.
 */
export function setupHelpModal(): void {
  const helpBtn = document.getElementById("help-btn")
  const modal = document.getElementById("help-modal")
  const closeBtn = document.getElementById("modal-close")

  if (!helpBtn || !modal || !closeBtn) return
  const binding = bindLayoutControl("help-modal", modal)
  if (!binding) return
  const { signal } = binding

  const open = () => {
    modal.classList.add("active")
    closeBtn.focus()
  }
  const close = () => {
    if (!modal.classList.contains("active")) return
    modal.classList.remove("active")
    helpBtn.focus()
  }

  helpBtn.addEventListener("click", open, { signal })
  closeBtn.addEventListener("click", close, { signal })

  // Close when the backdrop is clicked.
  modal.addEventListener(
    "click",
    (e) => {
      if (e.target === modal) close()
    },
    { signal }
  )

  // Close on Escape.
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") close()
    },
    { signal }
  )
}
