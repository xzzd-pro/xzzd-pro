export const overlayStyles = `/* Assistant Overlay Styles - Extracted from assistantBeautifier.tsx */

:host {
  /* Default Light Theme Variables */
  --xzzd-bg-color: #f0f2f8;
  --xzzd-text-color: #333;
  --xzzd-text-primary: #1a1a1a;
  --xzzd-text-secondary: #6b7280;
  --xzzd-card-bg: #fffffe;
  --xzzd-card-border: #e5e7eb;
  --xzzd-primary: #007bff;
  --xzzd-sidebar-bg: #fffffe;
  --xzzd-user-bubble-bg: #e8eaed;
  --xzzd-input-bg: #f0f4f9;
  --xzzd-input-hover: #e2e6ea;
  --xzzd-font-base: "LXGW WenKai Screen", "Microsoft YaHei", "PingFang SC", sans-serif;
  --xzzd-font-emoji: "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
  --math-filter: none;
}

:host([data-theme='dark']) {
  --xzzd-bg-color: #121212;
  --xzzd-text-color: #e0e0e0;
  --xzzd-text-primary: #f0f0f0;
  --xzzd-text-secondary: #a0a0a0;
  --xzzd-card-bg: #1f1f1f;
  --xzzd-card-border: #333;
  --xzzd-primary: #58a6ff;
  --xzzd-sidebar-bg: #1e1e1e;
  --xzzd-user-bubble-bg: #2f2f2f;
  --xzzd-input-bg: #26282c;
  --xzzd-input-hover: #333435;
  --xzzd-scrollbar-track: #2f2f2f;
  --xzzd-scrollbar-thumb: #555;
  --xzzd-scrollbar-thumb-hover: #777;
  --math-filter: invert(1) hue-rotate(180deg);
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0.2);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0,0,0,0.3);
}
:host([data-theme='dark']) ::-webkit-scrollbar-thumb {
  background-color: rgba(255,255,255,0.2);
}
:host([data-theme='dark']) ::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255,255,255,0.3);
}

/* Common Layout Styles */
.assistant-overlay, .assistant-fullpage {
  display: flex;
  flex: 1;
  height: 100%;
  font-family: var(--xzzd-font-base), var(--xzzd-font-emoji);
  font-variant-emoji: emoji;
  overflow: hidden;
  background-color: var(--xzzd-bg-color);
}

/* Ensure all form elements inherit the custom font */
button, input, select, textarea, label {
  font-family: inherit;
}
.empty-state-icon,
.flashcard-topic,
.flashcard-btn,
.flashcard-stat,
.status-toast span {
  font-family: var(--xzzd-font-emoji), var(--xzzd-font-base) !important;
  font-variant-emoji: emoji;
}

.assistant-fullpage {
    width: 100%;
    height: 100%;
}

.assistant-content-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

/* Overlay Specific Styles */
.assistant-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  align-items: center;
  justify-content: center;
}
.assistant-overlay-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}
.assistant-overlay-container {
  position: relative;
  width: 90vw;
  max-width: 1200px;
  height: 85vh;
  background-color: var(--xzzd-card-bg);
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.assistant-overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--xzzd-card-border);
  background-color: var(--xzzd-card-bg);
}
.assistant-overlay-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--xzzd-text-primary);
}
.assistant-close-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 24px;
  color: var(--xzzd-text-secondary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.assistant-close-btn:hover {
  background-color: var(--xzzd-bg-color);
  color: var(--xzzd-text-primary);
}

#clear-history-btn {
    font-size: 13px;
    padding: 6px 12px;
    border: 1px solid var(--xzzd-card-border);
    border-radius: 16px;
    background: transparent;
    color: var(--xzzd-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    margin-right: 12px;
}
#clear-history-btn:hover {
    border-color: var(--xzzd-text-secondary);
    color: var(--xzzd-text-primary);
    background-color: var(--xzzd-bg-color);
}
.assistant-overlay-content {
  flex: 1;
  overflow: hidden;
}
.assistant-layout {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
}

/* Drawer Overlay */
.drawer-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 900;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
  backdrop-filter: blur(2px);
}
.drawer-overlay.active {
  opacity: 1;
  visibility: visible;
}

/* Course Drawer */
.course-drawer {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 300px;
  background-color: var(--xzzd-card-bg);
  border-right: 1px solid var(--xzzd-card-border);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
}
.course-drawer.open {
  transform: translateX(0);
}

/* Sidebar internals */
.assistant-sidebar {
   display: none;
}
.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--xzzd-card-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--xzzd-text-primary);
}
.course-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.course-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 8px;
  transition: background-color 0.2s;
  border: 1px solid transparent;
}
.course-item:hover {
  background-color: var(--xzzd-bg-color);
}
.course-item.active {
  background-color: var(--xzzd-primary);
  color: white;
}
.course-item-title {
  font-weight: 500;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.course-item-info {
  font-size: 12px;
  color: var(--xzzd-text-secondary);
}
.course-item.active .course-item-info {
  color: rgba(255,255,255,0.8);
}
.course-item-title {
  font-weight: 500;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.course-item-info {
  font-size: 12px;
  color: var(--xzzd-text-secondary);
}
.course-item.active .course-item-info {
  color: rgba(255,255,255,0.8);
}
.chat-area {
  display: flex;
  flex: 1;
  width: 100%;
  flex-direction: column;
  height: 100%;
  background-color: var(--xzzd-bg-color);
  overflow: hidden;
}
.assistant-main-panels {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 0fr 1fr;
  gap: 0;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
  transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1), gap 0.3s ease;
  position: relative;
}
.chat-panel,
.flashcard-panel {
  min-height: 0;
  background-color: var(--xzzd-card-bg);
  border: 1px solid var(--xzzd-card-border);
  border-radius: 16px;
  overflow: hidden;
}
.chat-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.flashcard-panel {
  display: flex;
  min-width: 0;
  opacity: 0;
  transform: translateX(-100%);
  pointer-events: none;
  border-color: transparent;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease, border-color 0.2s ease;
}
.chat-area.split-open .assistant-main-panels {
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.chat-area.split-collapsing .assistant-main-panels {
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.chat-area.split-open .chat-panel {
  min-width: 0;
}
.chat-area.split-open .flashcard-panel {
  min-width: 0;
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
  border-color: var(--xzzd-card-border);
}
.chat-area.split-collapsing .flashcard-panel {
  min-width: 0;
  opacity: 0;
  transform: translateX(-100%);
  pointer-events: none;
  border-color: var(--xzzd-card-border);
}
.assistant-main-panels::after {
  content: '';
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  background: var(--xzzd-card-border);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.22s ease;
}
.chat-area.split-open .assistant-main-panels::after {
  opacity: 1;
}
.chat-area.split-collapsing .assistant-main-panels::after {
  opacity: 1;
}
.flashcard-messages-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.chat-area.split-open .flashcard-messages-container .message.assistant {
  flex: 1;
  min-height: 0;
}
.chat-area.split-open .flashcard-messages-container .message.assistant .message-body {
  flex: 1;
  min-height: 0;
}
.chat-area.split-open .flashcard-messages-container .flashcard-session {
  height: 100%;
}
/* Header Groups */
.header-left-group, .header-right-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Drawer Toggle Button */
.drawer-toggle-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--xzzd-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  padding: 0;
}
.drawer-toggle-btn:hover {
  background-color: var(--xzzd-bg-color);
  color: var(--xzzd-text-primary);
}
.split-toggle-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--xzzd-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  padding: 0;
}
.split-toggle-btn:hover {
  background-color: var(--xzzd-bg-color);
  color: var(--xzzd-text-primary);
}
.split-toggle-btn.active {
  background-color: var(--xzzd-bg-color);
  color: var(--xzzd-text-primary);
}

.chat-header {
  padding: 12px 24px;
  background-color: var(--xzzd-card-bg);
  border-bottom: 1px solid var(--xzzd-card-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  box-sizing: border-box;
}
.chat-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--xzzd-text-primary);
  font-weight: 600;
}
.attachment-name {
  font-size: 13px;
  color: var(--xzzd-text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 180px;
}
.messages-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.chat-course-subtitle {
  flex-shrink: 0;
  padding: 10px 24px 8px 24px;
  font-size: 13px;
  color: var(--xzzd-text-secondary);
  border-bottom: 1px solid var(--xzzd-card-border);
  background: var(--xzzd-card-bg);
  text-align: left;
}
.message {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  width: 100%;
  margin: 0 auto;
}
.message.user {
  align-items: flex-end;
}
.message-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.message-actions {
    position: absolute;
    left: -64px;
    bottom: 0;
    display: flex;
    gap: 4px;
    align-items: center;
    z-index: 100;
    pointer-events: auto;
}

.action-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--xzzd-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
}
.action-btn:hover {
    background-color: rgba(0,0,0,0.05);
    color: var(--xzzd-text-primary);
}
:host([data-theme='dark']) .action-btn:hover {
    background-color: rgba(255,255,255,0.1);
}
.action-icon {
    width: 16px;
    height: 16px;
    pointer-events: none;
}


.copy-icon {
    width: 16px;
    height: 16px;
}

/* Assistant message copy button - bottom-left */
.assistant-actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
}
.assistant-actions .action-btn {
    opacity: 0.5;
}
.assistant-actions .action-btn:hover {
    opacity: 1;
}

.message-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 100%;
    width: 100%;
    align-items: stretch;
}
.message.user .message-body {
    align-items: flex-end;
}

.message-text {
    background-color: var(--xzzd-card-bg);
    padding: 8px 16px;
    border-radius: 12px;
    line-height: 1.5;
    color: var(--xzzd-text-primary);
    font-size: 15px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    position: relative;
    z-index: 1;
}
.message-text p {
    margin: 0;
}
.message-text p + p {
    margin-top: 8px;
}
.message.user .message-text {
    background-color: var(--xzzd-user-bubble-bg);
    color: var(--xzzd-text-primary);
    border-radius: 18px;
    border-bottom-right-radius: 4px;
}

/* Attachment Cards */
.message-attachments {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 300px;
}
.attachment-card {
    background-color: var(--xzzd-input-bg);
    border: 1px solid var(--xzzd-card-border);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 250px;
    width: 100%;
    box-sizing: border-box;
}
:host([data-theme='dark']) .attachment-card {
    background-color: #1e1e1e;
    border-color: #333;
}
/* File badge base style */
.file-badge {
    font-size: 10px;
    font-weight: bold;
    padding: 4px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    flex-shrink: 0;
    min-width: 28px;
    text-align: center;
}
/* File badge color variants */
.file-badge-red {
    background-color: #ff5252;
    color: white;
}
.file-badge-blue {
    background-color: #2196f3;
    color: white;
}
.file-badge-green {
    background-color: #4caf50;
    color: white;
}
.file-badge-orange {
    background-color: #ff9800;
    color: white;
}
.file-badge-purple {
    background-color: #9c27b0;
    color: white;
}
.file-badge-gray {
    background-color: #757575;
    color: white;
}
.file-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    flex: 1;
}
.file-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--xzzd-text-primary);
}
.file-type {
    font-size: 11px;
    color: var(--xzzd-text-secondary);
}

/* Image thumbnail in chat messages */
.attachment-thumbnail {
    position: relative;
    display: inline-block;
}
.attachment-thumbnail .chat-thumbnail {
    width: 80px;
    height: 60px;
    border-radius: 8px;
    object-fit: cover;
    display: block;
}
/* Tooltip for image in chat */
.attachment-thumbnail[data-filename]::after {
    content: attr(data-filename);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    white-space: nowrap;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
    pointer-events: none;
    z-index: 1000;
}
.attachment-thumbnail[data-filename]:hover::after {
    opacity: 1;
    visibility: visible;
}

/* Assistant specific adjustments */
.message.assistant .message-text {
    background-color: transparent;
    padding: 0;
    box-shadow: none;
}
.message-content {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  box-shadow: none;
  line-height: 1.6;
  color: var(--xzzd-text-primary);
  font-size: 15px;
  flex: 1;
  overflow-x: auto;
}
.message.user .message-content {
  background-color: var(--xzzd-user-bubble-bg, #e0e0e0);
  color: var(--xzzd-text-primary);
  box-shadow: none;
}
:host([data-theme='light']) .message.user .message-content {
    background-color: #e8eaed;
}
.message-content h1 { font-size: 1.5em; font-weight: 700; margin: 16px 0 8px 0; }
.message-content h2 { font-size: 1.3em; font-weight: 600; margin: 14px 0 8px 0; }
.message-content h3 { font-size: 1.1em; font-weight: 600; margin: 12px 0 6px 0; }
.message-content p { margin: 0 0 12px 0; }
.message-content p:last-child { margin-bottom: 0; }
.message-content pre {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 12px 0;
}
.message.user .message-content pre {
  background-color: rgba(255, 255, 255, 0.1);
}
.message-content code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
  padding: 2px 4px;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}
.message.user .message-content code {
  background-color: rgba(255, 255, 255, 0.1);
}
.input-area {
  padding: 0 24px 24px 24px;
  background-color: var(--xzzd-card-bg);
  border-top: none; 
}
.modern-input-container {
  max-width: 100%;
  width: 100%;
  margin: 0;
  background-color: var(--xzzd-input-bg, #f0f4f9);
  border: 1px solid var(--xzzd-card-border);
  border-radius: 28px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: background-color 0.2s, border-color 0.2s;
}
:host([data-theme='light']) .modern-input-container {
    background-color: #e1e5eb;
}
.modern-input-container:focus-within {
  background-color: var(--xzzd-input-bg, #f0f4f9);
  border-color: var(--xzzd-primary);
}

.modern-textarea {
  width: 100%;
  min-height: 24px;
  max-height: 200px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  resize: none;
  font-family: inherit;
  font-size: 16px;
  line-height: 1.5;
  color: var(--xzzd-text-primary);
  outline: none;
  box-sizing: border-box;
  margin-bottom: 8px;
}

.preview-cards-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 16px 8px 16px;
    width: 100%;
    box-sizing: border-box;
}
.preview-card {
    background-color: rgba(0,0,0,0.05);
    border: 1px solid var(--xzzd-card-border);
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    position: relative;
}
:host([data-theme='dark']) .preview-card {
    background-color: #2f2f2f;
}
.preview-card img.preview-thumbnail {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    object-fit: cover;
}
/* Standalone preview-wrapper for input area */
.preview-wrapper {
    position: relative;
    display: inline-block;
    background-color: transparent;
    border: none;
}
.preview-wrapper img.preview-thumbnail {
    width: 80px;
    height: 60px;
    border-radius: 8px;
    object-fit: cover;
    display: block;
}
/* Custom tooltip for image preview */
.preview-wrapper[data-filename]::after {
    content: attr(data-filename);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    white-space: nowrap;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
    pointer-events: none;
    z-index: 1000;
}
.preview-wrapper[data-filename]:hover::after {
    opacity: 1;
    visibility: visible;
}
.preview-remove-btn {
    margin-left: 8px;
    cursor: pointer;
    opacity: 0.5;
    font-size: 16px;
}
.preview-remove-btn:hover { opacity: 1; }

/* Remove Attachment Button - positioned inside the thumbnail */
.preview-wrapper:hover .remove-attachment-btn {
    opacity: 1;
}
.remove-attachment-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.85);
    color: #333;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    line-height: 1;
    opacity: 0;
    transition: opacity 0.2s, background-color 0.2s;
    z-index: 10;
}
.remove-attachment-btn:hover {
    background-color: #ff5252;
    color: white;
}
:host([data-theme='dark']) .remove-attachment-btn {
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
}
:host([data-theme='dark']) .remove-attachment-btn:hover {
    background-color: #ff5252;
}

.modern-input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px;
}
.footer-left, .footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.modern-icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--xzzd-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}
.modern-icon-btn:hover {
  background-color: rgba(0,0,0,0.05);
}
:host([data-theme='dark']) .modern-icon-btn:hover {
    background-color: rgba(255,255,255,0.1);
}
.modern-icon-btn svg {
  width: 24px;
  height: 24px;
}
.flashcard-mode-toggle-btn {
  width: auto;
  min-width: 92px;
  height: 40px;
  border-radius: 20px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
}
#flashcard-mode-btn-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.settings-inline-btn svg {
  width: 22px;
  height: 22px;
}
.modern-icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.plus-btn {
  background-color: transparent;
}
.plus-btn svg {
  width: 22px;
  height: 22px;
}

.plus-menu-container {
    position: relative;
    display: flex;
    align-items: center;
}

/* Plus Menu Styles */
.plus-menu {
    position: absolute;
    bottom: 50px;
    left: 0;
    background-color: var(--xzzd-card-bg);
    border: 1px solid var(--xzzd-card-border);
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    min-width: 160px;
    z-index: 1000;
    animation: menu-pop 0.15s ease-out;
}
@keyframes menu-pop {
    from { opacity: 0; transform: translateY(10px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
.menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    color: var(--xzzd-text-primary);
    font-size: 14px;
    cursor: pointer;
    border-radius: 8px;
    text-align: left;
}
.menu-item:hover {
    background-color: var(--xzzd-bg-color);
}
.menu-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
}
.menu-icon svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
}

.send-btn { 
    margin-left: auto;
}
.send-btn svg {
    fill: var(--xzzd-text-primary);
}
.settings-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  color: var(--xzzd-text-secondary);
}
.settings-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  background-color: var(--xzzd-card-bg);
  border-left: 1px solid var(--xzzd-card-border);
  z-index: 100;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
}
.settings-panel.open { transform: translateX(0); }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--xzzd-text-secondary);
  text-align: center;
  padding: 40px;
}
.empty-state-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
.empty-state-icon svg {
  width: 48px;
  height: 48px;
  display: inline-block;
}
.form-group { margin-bottom: 20px; }
.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--xzzd-text-secondary);
  font-size: 14px;
}
.form-select, .form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--xzzd-card-border);
  background-color: var(--xzzd-bg-color);
  color: var(--xzzd-text-primary);
  font-size: 15px;
  box-sizing: border-box;
}
.primary-btn {
  width: 100%;
  padding: 12px;
  background-color: var(--xzzd-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}
.settings-header {
  padding: 20px;
  border-bottom: 1px solid var(--xzzd-card-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.settings-header h3 { margin: 0; font-size: 18px; color: var(--xzzd-text-primary); }
.close-settings-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 24px;
  color: var(--xzzd-text-secondary);
}
.settings-content { flex: 1; overflow-y: auto; padding: 20px; }
.settings-notice {
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
  font-size: 13px;
  line-height: 1.5;
}
.settings-notice strong {
  display: inline;
  color: #856404;
}
.settings-notice p {
  margin: 0;
  color: #856404;
}

/* Status Toast */
.status-toast {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background-color: var(--xzzd-card-bg);
  color: var(--xzzd-text-primary);
  padding: 10px 20px;
  border-radius: 30px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  border: 1px solid var(--xzzd-card-border);
  z-index: 1000;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-width: 80%;
  pointer-events: none;
}
.status-icon {
  width: 16px;
  height: 16px;
  display: inline-block;
  flex-shrink: 0;
}
.status-toast.show {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
.status-toast.success { border-color: #28a745; color: #28a745; }
.status-toast.error { border-color: #dc3545; color: #dc3545; }
.status-toast.info { border-color: var(--xzzd-primary); color: var(--xzzd-primary); }
.toast-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: toast-spin 0.8s linear infinite;
}
@keyframes toast-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Typing Indicator */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
}
.typing-dot {
  width: 6px;
  height: 6px;
  background-color: var(--xzzd-text-secondary);
  border-radius: 50%;
  animation: typing-bounce 1.4s infinite ease-in-out both;
}
.typing-dot:nth-child(1) { animation-delay: -0.32s; }
.typing-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Flashcard mode toggle */
#flashcard-mode-btn.active {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
#flashcard-send-btn {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
#flashcard-send-btn svg { fill: currentColor; }
#flashcard-send-btn[disabled] { opacity: 0.6; }

/* Flashcard bubble */
.flashcard-session {
  background: linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.05));
  border: 1px solid var(--xzzd-card-border);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  align-self: stretch;
}
.flashcard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.flashcard-topic {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--xzzd-text-primary);
  font-size: 16px;
}
.flashcard-progress {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--xzzd-text-secondary);
  align-items: center;
}
.flashcard-pack-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}
.flashcard-pack-btn {
  border: 1px solid var(--xzzd-card-border);
  background: var(--xzzd-card-bg);
  color: var(--xzzd-text-secondary);
  border-radius: 10px;
  height: 34px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
}
.flashcard-pack-btn:hover {
  background: var(--xzzd-input-bg);
  color: var(--xzzd-text-primary);
}
.flashcard-pack-btn.active {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
.flashcard-pack-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
.flashcard-pack-count {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.95;
}
.flashcard-pack-background-hint {
  min-height: 260px;
  margin: 0;
  border: none;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: var(--xzzd-text-secondary);
  background: transparent;
}
.flashcard-pack-background-hint.hidden {
  display: none;
}
.flashcard-pack-background-icon {
  width: 36px;
  height: 36px;
  opacity: 0.7;
  color: var(--xzzd-text-secondary);
}
.flashcard-pack-background-icon .icon-svg {
  width: 100%;
  height: 100%;
}
.flashcard-pack-background-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--xzzd-text-primary);
}
.flashcard-pack-background-subtitle {
  font-size: 13px;
  color: var(--xzzd-text-secondary);
  line-height: 1.5;
  max-width: 70%;
}
.flashcard-session-body {
  display: contents;
}
.flashcard-session.archived-only {
  min-height: 360px;
  padding: 12px;
  justify-content: flex-start;
}
.flashcard-session.archived-only .flashcard-pack-background-hint {
  flex: 1;
}
.flashcard-session.archived-only .flashcard-session-body {
  display: none;
}
.flashcard-stage {
  perspective: 1200px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-height: 400px;
}
.flashcard-card {
  position: relative;
  height: 100%;
  aspect-ratio: 3/4;
  max-width: calc(100% - 32px);
  transform-style: preserve-3d;
  transition: transform 0.5s ease;
  cursor: pointer;
}
.flashcard-face-tools {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  display: inline-flex;
  gap: 6px;
}
.flashcard-tool-btn {
  height: auto;
  min-width: 0;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(245, 158, 11, 0.34);
  background: rgba(245, 158, 11, 0.16);
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  margin: 0;
  box-sizing: border-box;
}
.flashcard-tool-btn:hover {
  background: rgba(245, 158, 11, 0.24);
  color: #78350f;
}
.flashcard-tool-btn.is-favorited {
  border-color: rgba(245, 158, 11, 0.48);
  background: rgba(245, 158, 11, 0.28);
  color: #78350f;
}
.flashcard-tool-btn.danger {
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.38);
  background: rgba(239, 68, 68, 0.14);
}
.flashcard-tool-btn.danger:hover {
  background: rgba(239, 68, 68, 0.22);
  color: #991b1b;
}
.flashcard-tool-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.flashcard-card.flipped { transform: rotateY(180deg); }
.flashcard-face {
  position: absolute;
  inset: 0;
  background: var(--xzzd-card-bg);
  border: 1px solid var(--xzzd-card-border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 12px 35px rgba(0,0,0,0.06);
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.flashcard-front { justify-content: center; align-items: center; text-align: center; }
.flashcard-back { transform: rotateY(180deg); justify-content: space-between; align-items: stretch; text-align: center; }
.flashcard-back-content {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}
.flashcard-type-tag {
  position: absolute;
  top: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 26px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
  font-weight: 700;
  font-size: 12px;
  line-height: 1;
}
.flashcard-face-tools .flashcard-tool-btn {
  height: 26px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.flashcard-question { font-size: 18px; font-weight: 700; color: var(--xzzd-text-primary); }
.flashcard-answer { font-size: 16px; color: var(--xzzd-text-primary); line-height: 1.6; text-align: center; }
.flashcard-cloze-extra { font-size: 13px; color: var(--xzzd-text-secondary); line-height: 1.6; }
.flashcard-math-block { margin: 8px 0; text-align: center; }
.flashcard-math-block img { max-width: 100%; }
.flashcard-math-inline { vertical-align: middle; margin: 0 2px; max-width: 100%; }
.flashcard-hint { color: var(--xzzd-text-secondary); font-size: 14px; }
.flashcard-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.flashcard-subtle-hint { color: var(--xzzd-text-secondary); font-size: 12px; }
.flashcard-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  margin-top: auto;
}
.flashcard-btn {
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
  box-shadow: 0 8px 18px rgba(0,0,0,0.08);
}
.flashcard-actions .flashcard-btn {
  width: 100%;
  padding: 10px 0;
}
.flashcard-btn:active { transform: translateY(1px) scale(0.98); }
.flashcard-btn.danger { background: #fee2e2; color: #b91c1c; }
.flashcard-btn.warning { background: #fef9c3; color: #92400e; }
.flashcard-btn.success { background: #dcfce7; color: #166534; }
.flashcard-btn.primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
.flashcard-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.45);
  border-radius: 14px;
  backdrop-filter: blur(3px);
}
.flashcard-overlay.hidden { display: none; }
.flashcard-overlay-card {
  background: var(--xzzd-card-bg);
  padding: 20px;
  border-radius: 14px;
  box-shadow: 0 14px 40px rgba(0,0,0,0.12);
  text-align: center;
  min-width: 240px;
}
.flashcard-overlay-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; color: var(--xzzd-text-primary); }
.flashcard-overlay-subtitle { color: var(--xzzd-text-secondary); margin-bottom: 12px; }
.flashcard-overlay-stats { display: flex; justify-content: center; gap: 12px; margin-bottom: 12px; }
.flashcard-overlay-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}
.flashcard-overlay-note {
  font-size: 12px;
  color: var(--xzzd-text-secondary);
  line-height: 1.5;
}
.flashcard-stat { padding: 8px 12px; border-radius: 10px; font-weight: 700; font-size: 14px; }
.flashcard-stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.flashcard-stat.red { background: #fee2e2; color: #b91c1c; }
.flashcard-stat.yellow { background: #fef9c3; color: #92400e; }
.flashcard-stat.green { background: #dcfce7; color: #166534; }
.icon-svg {
  width: 16px;
  height: 16px;
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}
.flashcard-topic .icon-svg {
  width: 18px;
  height: 18px;
}
.cloze-blank { border-bottom: 2px dotted var(--xzzd-text-secondary); padding: 0 4px; }
.cloze-highlight { background: #fef08a; padding: 0 4px; border-radius: 4px; }
.flashcard-tf-result.ok { color: #166534; }
.flashcard-tf-result.error { color: #b91c1c; }
.flashcard-tip-container {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--xzzd-card-bg);
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid var(--xzzd-card-border);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.flashcard-tip-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: hsl(var(--primary));
}
.flashcard-tip-content {
  flex: 1;
}
.flashcard-tip-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--xzzd-text-primary);
  margin-bottom: 4px;
}
.flashcard-tip-subtitle {
  font-size: 13px;
  color: var(--xzzd-text-secondary);
  margin-bottom: 8px;
}
.flashcard-tip-message {
  font-size: 13px;
  color: hsl(var(--primary));
  font-weight: 500;
}

`;