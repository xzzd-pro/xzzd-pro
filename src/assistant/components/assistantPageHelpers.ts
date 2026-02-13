import { themeIcons, navIcons } from "../../lib/components/icons";
import { PROVIDER_LABELS, PROVIDER_MODELS, PROVIDER_DEFAULTS } from "../config";
import type {
  ChatMessage,
  CourseInfo,
  AssistantSettings,
  Provider,
} from "../types";
import { renderFlashcardBubble, renderFlashcardTipBubble } from "./flashcardRenderer";
import { marked } from "marked";

export function renderAssistantPage(username: string = ""): string {
  return `
    <div class="assistant-layout">
      <main class="chat-area">
        <div id="assistant-main-panels" class="assistant-main-panels">
          <section id="flashcard-panel" class="flashcard-panel">
            <div id="flashcard-messages-container" class="flashcard-messages-container">
              <div class="empty-state">
                <div class="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" aria-hidden="true">
                    <path d="M4 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm2 0v12h10V5H6zm13 3h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-1h2v1h9v-9h-1V8z"/>
                  </svg>
                </div>
                <h3>闪卡区域</h3>
                <p>生成闪卡后将在这里展示</p>
              </div>
            </div>
          </section>

          <section id="chat-panel" class="chat-panel">
            <div id="chat-course-subtitle" class="chat-course-subtitle" style="display: none;"></div>
            <div id="messages-container" class="messages-container">
              <div class="empty-state">
                <div class="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" aria-hidden="true">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    <path d="M7 9h10v2H7zm0-3h10v2H7zm0 6h7v2H7z"/>
                  </svg>
                </div>
                <h3>欢迎使用学习助理</h3>
                <p>请在左侧选择一门课程开始提问</p>
              </div>
            </div>

            <div class="input-area">
              <div class="modern-input-container">
                <div id="file-preview-area" class="preview-cards-container" style="display: none;"></div>
                <textarea id="chat-input" class="modern-textarea" placeholder="问问学习助理" rows="1" disabled></textarea>
                
                <div class="modern-input-footer">
                  <div class="footer-left">
                    <div class="plus-menu-container">
                        <button id="attach-btn" class="modern-icon-btn plus-btn" title="更多选项">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                          </svg>
                        </button>
                        <div id="plus-menu" class="plus-menu" style="display: none;">
                            <button id="menu-upload-btn" class="menu-item">
                                <span class="menu-icon">
                                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
                                  </svg>
                                </span>
                                <span>上传文件/图片</span>
                            </button>
                        </div>
                    </div>
                    <button id="settings-btn" class="modern-icon-btn settings-inline-btn" title="设置">
                      ${navIcons.settings}
                    </button>
                    <button id="flashcard-mode-btn" class="modern-icon-btn flashcard-btn" title="闪卡模式">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-2.16-2.66c-.23-.28-.62-.38-.96-.23-.35.15-.58.5-.58.89V14h8v-2.36c0-.39-.23-.74-.58-.89-.34-.14-.73-.05-.96.23z"/>
                      </svg>
                    </button>
                    <input type="file" id="file-input" multiple style="display: none;" accept="image/*,.pdf,.txt,.md,.js,.ts,.java,.py,.json,.c,.cpp,.h">
                  </div>
                  
                  <div class="footer-right">
                    <button id="flashcard-send-btn" class="modern-icon-btn send-btn flashcard-send-btn" title="生成闪卡" style="display: none;" disabled>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 6h14v12H4z" opacity=".35"/>
                        <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h12v16z"/>
                        <path d="M9 9h6v2H9zm0 4h4v2H9z"/>
                      </svg>
                    </button>
                    <button id="send-btn" class="modern-icon-btn send-btn" disabled>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      
      ${renderSettingsPanel()}
    </div>
  `;
}

export function renderCourseList(
  courses: CourseInfo[],
  activeId?: string,
): string {
  if (courses.length === 0) {
    return '<div class="empty-state"><p>暂无正在进行的课程</p></div>';
  }

  return courses
    .map(
      (course) => `
    <div class="course-item ${String(course.id) === activeId ? "active" : ""}" data-id="${course.id}">
      <div class="course-item-title">${course.displayName}</div>
      <div class="course-item-info">
        <span>${course.instructors[0] || "未知教师"}</span>
      </div>
    </div>
  `,
    )
    .join("");
}

function getFileTypeInfo(
  name: string,
  type: string,
): { badge: string; colorClass: string; description: string } {
  const ext = name.split(".").pop()?.toLowerCase() || "";

  if (type === "pdf" || type === "application/pdf" || ext === "pdf") {
    return {
      badge: "PDF",
      colorClass: "file-badge-red",
      description: "PDF Document",
    };
  }

  const codeExtensions: Record<string, { badge: string; desc: string }> = {
    js: { badge: "JS", desc: "JavaScript" },
    jsx: { badge: "JSX", desc: "React JSX" },
    ts: { badge: "TS", desc: "TypeScript" },
    tsx: { badge: "TSX", desc: "React TSX" },
    py: { badge: "PY", desc: "Python" },
    java: { badge: "JAVA", desc: "Java" },
    c: { badge: "C", desc: "C Source" },
    cpp: { badge: "C++", desc: "C++ Source" },
    h: { badge: "H", desc: "C Header" },
    hpp: { badge: "H++", desc: "C++ Header" },
    go: { badge: "GO", desc: "Go" },
    rs: { badge: "RS", desc: "Rust" },
    rb: { badge: "RB", desc: "Ruby" },
    php: { badge: "PHP", desc: "PHP" },
    swift: { badge: "SWIFT", desc: "Swift" },
    kt: { badge: "KT", desc: "Kotlin" },
    scala: { badge: "SCALA", desc: "Scala" },
    sh: { badge: "SH", desc: "Shell Script" },
    bash: { badge: "BASH", desc: "Bash Script" },
    sql: { badge: "SQL", desc: "SQL" },
  };
  if (codeExtensions[ext]) {
    return {
      badge: codeExtensions[ext].badge,
      colorClass: "file-badge-blue",
      description: codeExtensions[ext].desc,
    };
  }

  const markupExtensions: Record<string, { badge: string; desc: string }> = {
    html: { badge: "HTML", desc: "HTML Document" },
    css: { badge: "CSS", desc: "Stylesheet" },
    scss: { badge: "SCSS", desc: "SASS Stylesheet" },
    less: { badge: "LESS", desc: "LESS Stylesheet" },
    xml: { badge: "XML", desc: "XML Document" },
    json: { badge: "JSON", desc: "JSON Data" },
    yaml: { badge: "YAML", desc: "YAML Config" },
    yml: { badge: "YAML", desc: "YAML Config" },
    toml: { badge: "TOML", desc: "TOML Config" },
  };
  if (markupExtensions[ext]) {
    return {
      badge: markupExtensions[ext].badge,
      colorClass: "file-badge-orange",
      description: markupExtensions[ext].desc,
    };
  }

  const docExtensions: Record<string, { badge: string; desc: string }> = {
    md: { badge: "MD", desc: "Markdown" },
    txt: { badge: "TXT", desc: "Text File" },
    doc: { badge: "DOC", desc: "Word Document" },
    docx: { badge: "DOCX", desc: "Word Document" },
    xls: { badge: "XLS", desc: "Excel Spreadsheet" },
    xlsx: { badge: "XLSX", desc: "Excel Spreadsheet" },
    ppt: { badge: "PPT", desc: "PowerPoint" },
    pptx: { badge: "PPTX", desc: "PowerPoint" },
    csv: { badge: "CSV", desc: "CSV Data" },
  };
  if (docExtensions[ext]) {
    return {
      badge: docExtensions[ext].badge,
      colorClass: "file-badge-green",
      description: docExtensions[ext].desc,
    };
  }

  const archiveExtensions = ["zip", "rar", "7z", "tar", "gz", "bz2"];
  if (archiveExtensions.includes(ext)) {
    return {
      badge: ext.toUpperCase(),
      colorClass: "file-badge-purple",
      description: "Archive",
    };
  }

  return {
    badge: ext.toUpperCase() || "FILE",
    colorClass: "file-badge-gray",
    description: "File",
  };
}

/**
 * Render a consistent attachment card for both chat history and input preview
 * @param name File name
 * @param type File mime type or internal type ('pdf', 'image', 'text')
 * @param content Optional content for image preview (base64 data URI)
 * @returns HTML string
 */
export function renderAttachmentCard(
  name: string,
  type: string,
  content?: string,
): string {
  const isImage = type === "image" || type.startsWith("image/");

  if (isImage && content) {
    // Image thumbnail with tooltip
    return `<div class="attachment-thumbnail" data-filename="${name}">
              <img src="${content}" class="chat-thumbnail" />
            </div>`;
  }

  // All file types use consistent card layout
  const { badge, colorClass, description } = getFileTypeInfo(name, type);

  return `<div class="attachment-card">
            <div class="file-badge ${colorClass}">${badge}</div>
            <div class="file-info">
              <div class="file-name">${name}</div>
              <div class="file-type">${description}</div>
            </div>
          </div>`;
}

export function renderChatMessage(message: ChatMessage, showFlashcard: boolean = true): string {
  const isUser = message.role === "user";
  if (message.flashcards) {
    return showFlashcard ? renderFlashcardBubble(message.flashcards, message.id) : renderFlashcardTipBubble(message.flashcards, message.id);
  }
  const contentHtml = parseMarkdown(message.content);

  let attachmentsHtml = "";
  if (message.attachments && message.attachments.length > 0) {
    attachmentsHtml = '<div class="message-attachments">';
    message.attachments.forEach((att) => {
      // For images, pass the content (base64) for thumbnail display
      const imageContent =
        att.type === "image" ? (att.content as string) : undefined;
      attachmentsHtml += renderAttachmentCard(att.name, att.type, imageContent);
    });
    attachmentsHtml += "</div>";
  }

  return `
    <div class="message ${isUser ? "user" : "assistant"}" id="${message.id}">
      <div class="message-body">
        ${attachmentsHtml}
        ${
          contentHtml
            ? `
          <div class="message-text">
            ${
              isUser
                ? `
              <div class="message-actions">
                <button class="action-btn recall-btn" title="撤回并编辑" data-id="${message.id}">
                  <svg viewBox="0 0 24 24" fill="none" class="action-icon">
                    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" fill="currentColor"/>
                  </svg>
                </button>
                <button class="action-btn copy-msg-btn" title="复制">
                  <svg viewBox="0 0 24 24" fill="none" class="action-icon">
                    <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            `
                : ""
            }
            ${contentHtml}
          </div>
          ${
            !isUser
              ? `
            <div class="assistant-actions">
              <button class="action-btn copy-msg-btn" title="复制回答">
                <svg viewBox="0 0 24 24" fill="none" class="action-icon">
                  <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          `
              : ""
          }
        `
            : ""
        }
      </div>
    </div>
  `;
}

export function parseMarkdown(text: string): string {
  if (!text) return "";

  // Remove tokens like <|begin_of_box|>, <|end_of_box|>, etc.
  let cleanText = text.replace(/<\|(?:begin_of_box|end_of_box|file_separator|thought)\|>/g, "").trim();

  // Process Math formulas first
  const mathBlocks: string[] = [];
  const inlineMath: string[] = [];

  let processedText = cleanText.replace(
    /\$\$\s*([\s\S]+?)\s*\$\$/g,
    (match, formula) => {
      mathBlocks.push(formula);
      return `@@BLOCK_MATH_${mathBlocks.length - 1}@@`;
    },
  );

  processedText = processedText.replace(/\$([^\$\n]+)\$/g, (match, formula) => {
    inlineMath.push(formula);
    return `@@INLINE_MATH_${inlineMath.length - 1}@@`;
  });

  // Use marked to convert Markdown to HTML
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  let html = marked.parse(processedText) as string;

  // Render Math formulas as images using codecogs
  html = html.replace(/@@BLOCK_MATH_(\d+)@@/g, (match, index) => {
    const formula = mathBlocks[parseInt(index)];
    const encoded = encodeURIComponent(formula.trim());
    return `<div class="math-block" style="text-align: center; margin: 12px 0;"><img src="https://latex.codecogs.com/svg.latex?\\Large&space;${encoded}" alt="math" style="filter: var(--math-filter);"></div>`;
  });

  html = html.replace(/@@INLINE_MATH_(\d+)@@/g, (match, index) => {
    const formula = inlineMath[parseInt(index)];
    const encoded = encodeURIComponent(formula.trim());
    return `<img src="https://latex.codecogs.com/svg.latex?${encoded}" alt="math" style="vertical-align: middle; filter: var(--math-filter); margin: 0 2px;">`;
  });

  return html;
}

export function renderSettingsPanel(): string {
  const providerOptions = (Object.keys(PROVIDER_LABELS) as Provider[])
    .map((p) => `<option value="${p}">${PROVIDER_LABELS[p]}</option>`)
    .join("");

  return `
    <div class="settings-panel" id="settings-panel">
      <div class="settings-header">
        <h3>设置</h3>
        <button id="close-settings-btn" class="close-settings-btn">&times;</button>
      </div>
      <div class="settings-content">
        <div class="settings-notice">
          <strong>⚠️ 重要提示</strong>
          <p>请使用支持<strong>视觉能力</strong>的模型（如 GPT-4o、Gemini 1.5 Pro/Flash 等），否则无法识别图片型 PDF 课件。</p>
        </div>
        
        <div class="form-group">
          <label for="provider-select">AI 服务商</label>
          <select id="provider-select" class="form-select">
            ${providerOptions}
          </select>
        </div>
        
        <div class="form-group">
          <label for="api-key-input">API Key</label>
          <input type="password" id="api-key-input" class="form-input" placeholder="请输入 API Key">
        </div>
        
        <div class="form-group">
          <label for="model-input">模型</label>
          <input type="text" id="model-input" class="form-input" placeholder="输入模型名称">
        </div>
        
        <div class="form-group">
          <label for="base-url-input">Base URL (可选)</label>
          <input type="text" id="base-url-input" class="form-input" placeholder="默认使用官方地址">
        </div>
        
        <div class="form-group" style="margin-top: 32px;">
          <button id="save-settings-btn" class="primary-btn">保存设置</button>
        </div>
      </div>
    </div>
  `;
}
