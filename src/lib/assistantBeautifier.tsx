import { renderAssistantPage, renderCourseList, renderChatMessage, renderAttachmentCard } from '../assistant/components/assistantPageHelpers'
import { loadSettings, saveSettings, loadChatHistory, saveChatHistory, clearChatHistory, createChatMessage } from '../assistant/storage'
import { fetchAllCourses, buildCourseContext } from '../assistant/services/courseDataService'
import { preloadCourseContext } from '../assistant/services/contextBuilder'
import { streamChat, formatErrorMessage } from '../assistant/services/chatService'
import { PROVIDER_DEFAULTS } from '../assistant/config'
import type { AssistantSettings, ChatMessage, CourseInfo, Provider, ProviderConfig, Attachment } from '../assistant/types'
import { convertPdfToImages } from '../assistant/services/fileService'
import { Storage } from "@plasmohq/storage"

const $ = (selector: string): HTMLElement | null => document.querySelector(selector)

let currentSettings: AssistantSettings | null = null
let currentCourseId: string | null = null
let currentCourseName: string = ''
let isGenerating: boolean = false
let courses: CourseInfo[] = []
let messages: ChatMessage[] = []
let pendingAttachments: File[] = []
let isCoursewareLoaded = false // New state for manual loading
let overlayHost: HTMLElement | null = null
let overlayElement: HTMLElement | null = null

export function isAssistantOpen(): boolean {
  return overlayHost !== null && document.body.contains(overlayHost)
}

export function closeAssistant(): void {
  if (overlayHost && document.body.contains(overlayHost)) {
    overlayHost.remove()
    overlayHost = null
    overlayElement = null
    document.body.style.overflow = ''
  }
}

// Factory function to create the assistant host element
export async function createAssistantHost(): Promise<HTMLElement> {
  // Create Host
  const host = document.createElement('div')
  host.id = 'xzzdpro-assistant-embedded-host'
  host.style.width = '100%'
  host.style.height = '100%'
  host.style.overflow = 'hidden'

  // Create Shadow Root
  const shadow = host.attachShadow({ mode: 'open' })

  // Inject Styles into Shadow DOM (true = full height/width style)
  injectOverlayStyles(shadow, true)

  // Create Container
  overlayElement = document.createElement('div')
  overlayElement.className = 'assistant-fullpage'
  overlayElement.innerHTML = `
    <div class="assistant-content-container">
      ${renderAssistantPage('')}
    </div>
  `

  shadow.appendChild(overlayElement)

  // Set overlayHost for global reference
  overlayHost = host

  // Initialize Logic
  // Apply initial theme
  const storage = new Storage()
  const theme = await storage.get('theme') || 'light'
  host.setAttribute('data-theme', theme)

  // Watch for theme changes
  storage.watch({
    theme: (change) => {
      if (host) host.setAttribute('data-theme', change.newValue || 'light')
    }
  })

  // Start initialization but don't wait for it to return the element
  initAssistant().catch(err => console.error('XZZDPRO: Async init failed', err))

  return host
}

// Helper to inject styles. isFullPage affects some styles if needed
function injectOverlayStyles(root: ShadowRoot, isFullPage: boolean = false): void {
  const style = document.createElement('style')
  style.textContent = `
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
      --xzzd-input-bg: #1e1f20;
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
      font-family: "LXGW WenKai Screen", sans-serif;
      overflow: hidden;
      background-color: var(--xzzd-bg-color);
    }
    
    /* Ensure all form elements inherit the custom font */
    button, input, select, textarea, label {
      font-family: inherit;
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
      display: flex; /* Change to flex for simpler stacking */
    }
    
    /* Drawer Overlay */
    .drawer-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 900; /* Below drawer, above content */
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s;
      backdrop-filter: blur(2px);
    }
    .drawer-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    /* Course Drawer (formerly Sidebar) */
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
      z-index: 1000; /* High z-index */
      transform: translateX(-100%); /* Hidden by default */
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
    }
    .course-drawer.open {
      transform: translateX(0);
    }

    /* Revisit sidebar internals */
    .assistant-sidebar {
      /* Keep generic naming for compatibility if used elsewhere, 
         but course-drawer is the new main container */
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
    .chat-area {
      display: flex;
      flex: 1;
      width: 100%;
      flex-direction: column;
      height: 100%;
      background-color: var(--xzzd-bg-color);
      overflow: hidden;
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

    .chat-header {
      padding: 12px 24px; /* Slightly reduced vertical padding */
      background-color: var(--xzzd-card-bg);
      border-bottom: 1px solid var(--xzzd-card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 60px; /* Fixed height for consistency */
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
      max-width: 180px; /* Limit width */
    }
    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .message {
      display: flex;
      flex-direction: column; /* Default stack */
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
        /* position: relative;  Removed, anchor is now message-text */
    }
    
    .message-actions {
        position: absolute;
        left: -64px; /* Move further left to fit 2 buttons */
        bottom: 0;
        display: flex;
        gap: 4px;
        align-items: center;
        z-index: 100; /* Ensure on top */
        pointer-events: auto; /* Ensure clickable */
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
        /* Opacity removed - always visible */
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
        pointer-events: none; /* Let clicks pass to button */
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
        position: relative; /* Anchor for Copy Button */
        z-index: 1; /* Establish stacking context */
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
        border-radius: 18px; /* More rounded pill shape */
        border-bottom-right-radius: 4px; /* Slight accent */
    }

    /* Attachment Cards */
    .message-attachments {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        max-width: 300px; /* Limit width of cards */
    }
    .attachment-card {
        background-color: var(--xzzd-input-bg);
        border: 1px solid var(--xzzd-card-border);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 250px; /* Fixed max width to prevent overflow */
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
        min-width: 0; /* Crucial for flex child truncation */
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
      /* Background matches chat area to blend in */
      background-color: var(--xzzd-bg-color); 
      border-top: none; 
    }
    .modern-input-container {
      max-width: 100%;
      width: 100%;
      margin: 0;
      background-color: var(--xzzd-input-bg, #f0f4f9);
      border-radius: 28px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: background-color 0.2s;
    }
    :host([data-theme='light']) .modern-input-container {
        background-color: #e1e5eb; /* Slightly darker than f0f4f9 for better visibility */
    }
    .modern-input-container:focus-within {
        background-color: var(--xzzd-input-bg, #f0f4f9); 
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
    .modern-icon-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
    
    .plus-btn {
        background-color: rgba(0,0,0,0.05);
    }
    :host([data-theme='dark']) .plus-btn {
        background-color: #2f2f2f; 
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
  `
  root.appendChild(style)
}

export async function openAssistant(): Promise<void> {
  console.log('XZZDPRO: openAssistant called')
  if (isAssistantOpen()) {
    console.log('XZZDPRO: Assistant already open, closing')
    closeAssistant()
    return
  }

  document.body.style.overflow = 'hidden'

  // Create Host
  overlayHost = document.createElement('div')
  overlayHost.id = 'xzzdpro-assistant-host'
  overlayHost.style.position = 'fixed'
  overlayHost.style.zIndex = '2147483647' // Max z-index
  overlayHost.style.top = '0'
  overlayHost.style.left = '0'
  overlayHost.style.width = '0'
  overlayHost.style.height = '0'

  // Create Shadow Root
  const shadow = overlayHost.attachShadow({ mode: 'open' })

  // Inject Styles into Shadow DOM
  injectOverlayStyles(shadow, false)

  // Create Container (overlayElement)
  overlayElement = document.createElement('div')
  overlayElement.className = 'assistant-overlay'
  overlayElement.innerHTML = `
    <div class="assistant-overlay-backdrop"></div>
    <div class="assistant-overlay-container">
      <div class="assistant-overlay-header">
        <h2>学习助理</h2>
        <button class="assistant-close-btn" id="assistant-close-btn">&times;</button>
      </div>
      <div class="assistant-overlay-content">
        ${renderAssistantPage('')}
      </div>
    </div>
  `

  shadow.appendChild(overlayElement)
  document.body.appendChild(overlayHost)

  const closeBtn = overlayElement.querySelector('#assistant-close-btn')
  closeBtn?.addEventListener('click', closeAssistant)

  const backdrop = overlayElement.querySelector('.assistant-overlay-backdrop')
  backdrop?.addEventListener('click', closeAssistant)

  document.addEventListener('keydown', handleEscClose)

  // Apply initial theme
  const storage = new Storage()
  const theme = await storage.get('theme') || 'light'
  console.log('XZZDPRO: Retrieved theme from storage:', theme)
  if (overlayHost) {
    overlayHost.setAttribute('data-theme', theme)
    console.log('XZZDPRO: Applied theme to host:', overlayHost.getAttribute('data-theme'))
  }

  // Watch for theme changes
  storage.watch({
    theme: (change) => {
      console.log('XZZDPRO: Theme changed in storage:', change.newValue)
      if (overlayHost) overlayHost.setAttribute('data-theme', change.newValue || 'light')
    }
  })

  await initAssistant()
}

function handleEscClose(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    const drawer = overlayElement?.querySelector('#course-drawer')
    const overlay = overlayElement?.querySelector('#drawer-overlay')

    if (drawer?.classList.contains('open')) {
      drawer.classList.remove('open')
      overlay?.classList.remove('active')
      return
    }

    if (isAssistantOpen()) {
      closeAssistant()
      document.removeEventListener('keydown', handleEscClose)
    }
  }
}

async function initAssistant() {
  try {
    currentSettings = await loadSettings()
    courses = await fetchAllCourses()

    // Setup Drawer Logic
    const drawer = overlayElement?.querySelector('#course-drawer')
    const overlay = overlayElement?.querySelector('#drawer-overlay')
    const toggleBtn = overlayElement?.querySelector('#drawer-toggle-btn')

    function closeDrawer() {
      drawer?.classList.remove('open')
      overlay?.classList.remove('active')
    }

    function openDrawer() {
      drawer?.classList.add('open')
      overlay?.classList.add('active')
    }

    toggleBtn?.addEventListener('click', openDrawer)
    overlay?.addEventListener('click', closeDrawer)

    const courseListEl = overlayElement?.querySelector('#course-list')
    if (courseListEl) {
      courseListEl.innerHTML = renderCourseList(courses)

      courseListEl.querySelectorAll('.course-item').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-id')
          if (id) {
            switchCourse(id)
            closeDrawer()
          }
        })
      })
    }

    setupSettingsHandlers()
    setupChatHandlers()

  } catch (error) {
    console.error('XZZDPRO: Failed to init assistant', error)
  }
}

async function switchCourse(courseId: string) {
  if (currentCourseId === courseId) return

  currentCourseId = courseId
  const course = courses.find(c => String(c.id) === courseId)
  if (!course) return

  currentCourseName = course.displayName
  isCoursewareLoaded = false // Reset loading state

  // Update UI active state
  overlayElement?.querySelectorAll('.course-item').forEach(el => {
    if (el.getAttribute('data-id') === courseId) {
      el.classList.add('active')
    } else {
      el.classList.remove('active')
    }
  })

  // Update Header
  const headerEl = overlayElement?.querySelector('#current-course-name')
  if (headerEl) headerEl.textContent = currentCourseName

  // Show clear button
  const clearBtn = overlayElement?.querySelector('#clear-history-btn') as HTMLElement
  if (clearBtn) clearBtn.style.display = ''

  // Enable inputs
  const chatInput = overlayElement?.querySelector('#chat-input') as HTMLTextAreaElement
  const sendBtn = overlayElement?.querySelector('#send-btn') as HTMLButtonElement
  const attachBtn = overlayElement?.querySelector('#attach-btn') as HTMLButtonElement
  if (chatInput) chatInput.disabled = false
  if (sendBtn) sendBtn.disabled = false
  if (attachBtn) attachBtn.disabled = false

  // Load history
  const session = await loadChatHistory(courseId)
  messages = session?.messages || []

  renderMessages()
}

let statusTimeout: NodeJS.Timeout | null = null

function showStatus(message: string, type: 'success' | 'error' | 'info' = 'info') {
  let toast = overlayElement?.querySelector('#status-toast') as HTMLElement
  if (!toast) {
    // Create if missing (append to chat area if possible, or overlay root)
    toast = document.createElement('div')
    toast.id = 'status-toast'
    toast.className = 'status-toast'
    // Try to find chat area to position relatively, otherwise overlay
    const chatArea = overlayElement?.querySelector('.chat-area') || overlayElement?.querySelector('.assistant-overlay-container') || overlayElement
    if (chatArea) {
      // Make sure parent has relative positioning if we want it standard
      // CSS handles position absolute.
      chatArea.appendChild(toast)
    }
  }

  // Icon handling
  let icon = ''
  if (type === 'info') icon = '<div class="toast-spinner"></div>'
  if (type === 'success') icon = '✅'
  if (type === 'error') icon = '❌'

  toast.innerHTML = `${icon}<span>${message}</span>`
  toast.className = `status-toast show ${type}`

  if (statusTimeout) clearTimeout(statusTimeout)

  // Auto hide after delay unless it's an error? Or just always hide.
  // For file reading (info), we might want it to stay until done.
  // But individual file success logs flash by quickly.
  // Let's set a 3s timeout for all messages to keep it clean.
  statusTimeout = setTimeout(() => {
    toast.classList.remove('show')
  }, 3000)
}

function renderMessages() {
  const container = overlayElement?.querySelector('#messages-container')
  if (!container) return

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            <path d="M7 9h10v2H7zm0-3h10v2H7zm0 6h7v2H7z"/>
          </svg>
        </div>
        <h3>${currentCourseName || '请选择课程'}</h3>
        <p>基于课程资料回答您的问题</p>
      </div>
    `
    return
  }

  container.innerHTML = messages.map(msg => renderChatMessage(msg)).join('')
  scrollToBottom()
}

function scrollToBottom() {
  const container = overlayElement?.querySelector('#messages-container')
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

function setupChatHandlers() {
  console.log('XZZDPRO: setupChatHandlers called')
  const input = overlayElement?.querySelector('#chat-input') as HTMLTextAreaElement
  const sendBtn = overlayElement?.querySelector('#send-btn') as HTMLButtonElement
  const clearBtn = overlayElement?.querySelector('#clear-history-btn') as HTMLButtonElement
  const attachBtn = overlayElement?.querySelector('#attach-btn') as HTMLButtonElement
  const fileInput = overlayElement?.querySelector('#file-input') as HTMLInputElement

  // Clear History
  clearBtn?.addEventListener('click', async () => {
    if (confirm('确定要清空当前课程的聊天记录吗？')) {
      messages = []
      renderMessages()
      if (currentCourseId) {
        await saveChatHistory(currentCourseId, {
          courseId: currentCourseId,
          courseName: currentCourseName,
          messages: [],
          updatedAt: Date.now()
        })
      }
    }
  })
  const previewArea = overlayElement?.querySelector('#file-preview-area') as HTMLElement
  const plusMenu = overlayElement?.querySelector('#plus-menu') as HTMLElement
  const menuUploadBtn = overlayElement?.querySelector('#menu-upload-btn') as HTMLButtonElement
  const menuReadBtn = overlayElement?.querySelector('#menu-read-courseware-btn') as HTMLButtonElement

  console.log('XZZDPRO: Elements found:', {
    input: !!input,
    attachBtn: !!attachBtn,
    plusMenu: !!plusMenu,
    menuUploadBtn: !!menuUploadBtn,
    menuReadBtn: !!menuReadBtn
  })

  // Attach Button (Toggle Menu)
  if (attachBtn) {
    attachBtn.addEventListener('click', (e) => {
      console.log('XZZDPRO: attachBtn clicked')
      e.stopPropagation()
      e.preventDefault() // Try preventing default just in case
      if (plusMenu) {
        const isVisible = plusMenu.style.display !== 'none'
        plusMenu.style.display = isVisible ? 'none' : 'block'
        console.log('XZZDPRO: plusMenu toggled, new display:', plusMenu.style.display)
      } else {
        console.error('XZZDPRO: plusMenu not found when clicking attachBtn')
      }
    })
  } else {
    console.error('XZZDPRO: attachBtn not found in setupChatHandlers')
  }

  // Menu Upload Item
  menuUploadBtn?.addEventListener('click', (e) => {
    console.log('XZZDPRO: menuUploadBtn clicked')
    e.stopPropagation()
    fileInput?.click()
    if (plusMenu) plusMenu.style.display = 'none'
  })

  // Menu Read Courseware Item
  menuReadBtn?.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (plusMenu) plusMenu.style.display = 'none'

    if (!currentCourseId) {
      showStatus('请先选择课程', 'error')
      return
    }

    if (isCoursewareLoaded) {
      showStatus('课程资料已加载', 'success')
      return
    }

    try {
      // Temporarily fetch context just for preloading
      const context = await buildCourseContext(currentCourseId)
      await preloadCourseContext(context, (msg, type) => showStatus(msg, type || 'info'))
      isCoursewareLoaded = true
      showStatus('课程资料阅读完成', 'success')
    } catch (error) {
      console.error('Failed to load courseware:', error)
      showStatus('加载失败: ' + String(error), 'error')
    }
  })


  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (plusMenu && plusMenu.style.display !== 'none') {
      const target = e.composedPath()[0] as HTMLElement
      if (!target.closest('.plus-menu-container')) {
        plusMenu.style.display = 'none'
      }
    }
  })

  // File Input Change
  fileInput?.addEventListener('change', (e) => {
    const files = Array.from((e.target as HTMLInputElement).files || [])
    if (files.length > 0) {
      pendingAttachments = [...pendingAttachments, ...files]
      renderPreviews()
      // Reset input so same file can be selected again
      fileInput.value = ''
    }
  })

  function renderPreviews() {
    if (!previewArea) return

    if (pendingAttachments.length === 0) {
      previewArea.style.display = 'none'
      previewArea.innerHTML = ''
      return
    }

    previewArea.style.display = 'flex'
    previewArea.innerHTML = pendingAttachments.map((file, index) => {
      const isImage = file.type.startsWith('image/')
      let innerContent = ''

      if (isImage) {
        const url = URL.createObjectURL(file)
        innerContent = `<img src="${url}" class="preview-thumbnail" />`
      } else {
        innerContent = renderAttachmentCard(file.name, file.type)
      }

      // For images, add data-filename for tooltip; for files, no tooltip needed (they show name in card)
      const dataAttr = isImage ? `data-filename="${file.name}"` : ''

      return `
        <div class="preview-wrapper" ${dataAttr}>
            ${innerContent}
            <button class="remove-attachment-btn" data-index="${index}">×</button>
        </div>`
    }).join('')

    // Remove Attachment Button - event delegation for dynamically added elements
    previewArea.querySelectorAll('.remove-attachment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLElement).getAttribute('data-index') || '-1')
        if (index > -1) {
          pendingAttachments = pendingAttachments.filter((_, i) => i !== index)
          renderPreviews()
        }
      })
    })
  }

  // Use Capture Phase on Root Overlay to ensure we catch all clicks for copy/recall buttons
  // This must be OUTSIDE renderPreviews() so it's always bound
  if (overlayElement) {
    overlayElement.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement
      // Verbose Debugging
      // console.log('[Assistant Debug] Root Click:', target.tagName, target.className)

      // Check for buttons using composed path if available or closest
      const composedPath = e.composedPath ? e.composedPath() : []
      // console.log('[Assistant Debug] Path:', composedPath)

      // Helper to find in path
      const findInPath = (selector: string) => {
        for (const node of composedPath) {
          if (node instanceof HTMLElement && node.matches(selector)) return node
        }
        return target.closest(selector)
      }

      const copyBtn = findInPath('.copy-msg-btn') as HTMLElement
      const recallBtn = findInPath('.recall-btn') as HTMLElement

      if (copyBtn || recallBtn) {
        console.log('[Assistant Debug] Action Button Detected!', { copyBtn, recallBtn })
        e.stopPropagation()
        e.stopImmediatePropagation() // Halt other listeners if any
      }

      // Copy Button Logic
      if (copyBtn) {
        console.log('[Assistant Debug] Executing Copy...')
        const messageEl = copyBtn.closest('.message')
        const msgId = messageEl?.getAttribute('id')

        if (msgId) {
          try {
            // Find the original message to preserve Markdown formatting
            const originalMsg = messages.find(m => m.id === msgId)
            const textToCopy = originalMsg?.content?.trim() || ''

            if (textToCopy) {
              await navigator.clipboard.writeText(textToCopy)
              showStatus('已复制', 'success')
            }
          } catch (err) {
            console.error('[Assistant Debug] Copy failed:', err)
            showStatus('复制失败', 'error')
          }
        }
        return
      }

      // Recall Button Logic
      if (recallBtn) {
        console.log('[Assistant Debug] Executing Recall...')
        const msgId = recallBtn.getAttribute('data-id')
        if (!msgId) return

        const index = messages.findIndex(m => m.id === msgId)
        if (index === -1) return

        if (confirm('确定要撤回此消息并重新编辑吗？')) {
          const msg = messages[index]

          // 1. Restore Content
          if (input) {
            input.value = msg.content
            input.disabled = false
            adjustTextareaHeight(input)
          }

          // 2. Restore Attachments
          if (msg.attachments && msg.attachments.length > 0) {
            showStatus('正在恢复附件...', 'info')
            try {
              const restoredFiles: File[] = []
              for (const att of msg.attachments) {
                // Prefer originalData (full original file) over content (processed data)
                const dataToRestore = att.originalData ||
                  (Array.isArray(att.content) ? att.content[0] : att.content)

                if (typeof dataToRestore === 'string' && dataToRestore.startsWith('data:')) {
                  // Convert data URI back to File
                  const res = await fetch(dataToRestore)
                  const blob = await res.blob()

                  // Determine correct MIME type
                  let mimeType = 'application/octet-stream'
                  if (att.type === 'pdf') {
                    mimeType = 'application/pdf'
                  } else if (att.type === 'image') {
                    mimeType = blob.type || 'image/png'
                  } else if (att.type === 'text') {
                    mimeType = 'text/plain'
                  }

                  const file = new File([blob], att.name, { type: mimeType })
                  restoredFiles.push(file)
                }
              }
              pendingAttachments = restoredFiles
              renderPreviews()
              showStatus(`已恢复 ${restoredFiles.length} 个附件`, 'success')
            } catch (err) {
              console.error('[Assistant Debug] Failed to restore attachments', err)
              showStatus('附件恢复失败', 'error')
            }
          }

          messages = messages.slice(0, index)
          renderMessages()
          await saveChatHistory(currentCourseId, {
            courseId: currentCourseId,
            courseName: currentCourseName,
            messages,
            updatedAt: Date.now()
          })
        }
      }
    }, { capture: true })
  } else {
    console.error('[Assistant Debug] overlayElement not found!')
  }


  const sendMessage = async () => {
    const content = input?.value.trim() || ''

    if (!content && pendingAttachments.length === 0) return
    if (!currentCourseId || isGenerating) return

    // Disable inputs
    if (input) {
      input.value = ''
      adjustTextareaHeight(input)
      input.disabled = true
    }
    if (sendBtn) sendBtn.disabled = true
    if (attachBtn) attachBtn.disabled = true
    isGenerating = true

    // Process attachments
    const processedAttachments: Attachment[] = []

    if (pendingAttachments.length > 0) {
      // if (showStatus) showStatus('正在处理附件...', 'info')

      try {
        for (const file of pendingAttachments) {
          if (file.type.startsWith('image/')) {
            const base64 = await readFileAsBase64(file)
            processedAttachments.push({
              type: 'image',
              name: file.name,
              content: base64
            })
          } else if (file.type === 'application/pdf') {
            // Store both original file and converted images
            const originalBase64 = await readFileAsBase64(file)
            const blob = new Blob([file], { type: 'application/pdf' })
            const images = await convertPdfToImages(blob)
            processedAttachments.push({
              type: 'pdf',
              name: file.name,
              content: images,           // Images for LLM
              originalData: originalBase64  // Original PDF for recall
            })
          } else {
            const textContent = await readFileAsText(file)
            processedAttachments.push({
              type: 'text',
              name: file.name,
              content: textContent
            })
          }
        }
      } catch (e) {
        console.error('Attachment processing failed:', e)
        if (showStatus) showStatus(`附件处理失败: ${String(e)}`, 'error')
        isGenerating = false
        if (input) input.disabled = false
        if (sendBtn) sendBtn.disabled = false
        if (attachBtn) attachBtn.disabled = false
        return
      }

      pendingAttachments = []
      renderPreviews()
    }

    const userMsg = createChatMessage('user', content)
    if (processedAttachments.length > 0) {
      userMsg.attachments = processedAttachments
    }

    messages.push(userMsg)
    renderMessages()

    const assistantMsg = createChatMessage('assistant', '')
    messages.push(assistantMsg)
    const container = overlayElement?.querySelector('#messages-container')
    if (container) {
      const loadingDiv = document.createElement('div')
      loadingDiv.id = `loading-${assistantMsg.id}`
      loadingDiv.className = 'message assistant'
      loadingDiv.innerHTML = `
        <div class="message-body">
            <div class="message-text">
              <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
              </div>
            </div>
        </div>
      `
      container.appendChild(loadingDiv)
      scrollToBottom()
    }

    try {
      let context = await buildCourseContext(currentCourseId)

      // If explicitly loaded, use full context; otherwise, strip materials to prevent auto-fetch
      if (!isCoursewareLoaded) {
        context = { ...context, materials: [] } // Keep homeworks, strip files
      }

      const provider = currentSettings!.provider
      const config = currentSettings!.configs[provider] as ProviderConfig

      let responseText = ''

      await streamChat({
        messages: messages.slice(0, -1),
        context,
        provider,
        config: {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl || PROVIDER_DEFAULTS[provider].baseUrl,
          model: config.model
        },
        onProgress: (msg) => {
          showStatus(msg, 'info')

          if (responseText) {
            assistantMsg.content = responseText
            const msgEl = overlayElement?.querySelector(`#${assistantMsg.id}`)
            if (msgEl) {
              msgEl.outerHTML = renderChatMessage(assistantMsg)
            }
          }
        },
        onChunk: (chunk) => {
          responseText += chunk
          assistantMsg.content = responseText

          const loadingEl = overlayElement?.querySelector(`#loading-${assistantMsg.id}`)
          if (loadingEl) loadingEl.remove()

          const msgEl = overlayElement?.querySelector(`#${assistantMsg.id}`)
          if (msgEl) {
            msgEl.outerHTML = renderChatMessage(assistantMsg)
          } else {
            container?.insertAdjacentHTML('beforeend', renderChatMessage(assistantMsg))
          }
          scrollToBottom()
        }
      })

      await saveChatHistory(currentCourseId, {
        courseId: currentCourseId,
        courseName: currentCourseName,
        messages,
        updatedAt: Date.now()
      })

    } catch (error) {
      console.error('Chat error:', error)
      const errorMsg = error instanceof Error ? formatErrorMessage(error) : '发生未知错误'
      assistantMsg.content = `❌ ${errorMsg}`
      renderMessages()
    } finally {
      isGenerating = false
      if (input) {
        input.disabled = false
        input.focus()
      }
      if (sendBtn) sendBtn.disabled = false
      if (attachBtn) attachBtn.disabled = false

      const loadingEl = overlayElement?.querySelector(`#loading-${assistantMsg.id}`)
      if (loadingEl) loadingEl.remove()
    }
  }

  sendBtn?.addEventListener('click', sendMessage)

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  })

  input?.addEventListener('input', () => adjustTextareaHeight(input))

  // Clear Button logic
  // Use delegation for clear button to ensure it works even if DOM slightly changes
  overlayElement?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement
    const clearBtn = target.closest('#clear-history-btn')

    if (clearBtn) {
      console.log('XZZDPRO: Clear history clicked')
      if (!currentCourseId) {
        console.warn('XZZDPRO: No current course ID')
        return
      }

      if (!confirm('确定要清除本课程的对话历史吗？')) return

      await clearChatHistory(currentCourseId)
      messages = []
      renderMessages()
    }
  })
}

function adjustTextareaHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = (el.scrollHeight) + 'px'
}

function setupSettingsHandlers() {
  const panel = overlayElement?.querySelector('#settings-panel')
  const openBtn = overlayElement?.querySelector('#settings-btn')
  const closeBtn = overlayElement?.querySelector('#close-settings-btn')
  const providerSelect = overlayElement?.querySelector('#provider-select') as HTMLSelectElement
  const modelInput = overlayElement?.querySelector('#model-input') as HTMLInputElement
  const apiKeyInput = overlayElement?.querySelector('#api-key-input') as HTMLInputElement
  const baseUrlInput = overlayElement?.querySelector('#base-url-input') as HTMLInputElement
  const saveBtn = overlayElement?.querySelector('#save-settings-btn')

  const openSettings = () => {
    if (!currentSettings) return
    panel?.classList.add('open')

    const provider = currentSettings.provider
    providerSelect.value = provider

    const config = currentSettings.configs[provider]
    const defaults = PROVIDER_DEFAULTS[provider]

    if (config) {
      apiKeyInput.value = config.apiKey || ''
      baseUrlInput.value = config.baseUrl || ''
      modelInput.value = config.model
    }
    
    baseUrlInput.placeholder = defaults.baseUrl || '官方默认地址'
  }

  const closeSettings = () => panel?.classList.remove('open')

  const saveSettingsHandler = async () => {
    if (!currentSettings || !saveBtn) return
    (saveBtn as HTMLButtonElement).disabled = true;
    (saveBtn as HTMLButtonElement).textContent = '保存中...'

    try {
      const provider = providerSelect.value as Provider
      const apiKey = apiKeyInput.value.trim()
      const baseUrl = baseUrlInput.value.trim()
      const model = modelInput.value.trim()
      
      // 验证必填字段
      if (!apiKey) {
        alert('❌ API Key 不能为空')
        return
      }
      if (!model) {
        alert('❌ 模型名称不能为空（如：gpt-4, gpt-4-vision 等）')
        return
      }
      
      const config = {
        apiKey,
        baseUrl,
        model
      }

      currentSettings.provider = provider
      currentSettings.configs[provider] = config

      await saveSettings(currentSettings)
      showStatus('设置已保存', 'success')
      closeSettings()
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('❌ 保存失败，请重试')
    } finally {
      (saveBtn as HTMLButtonElement).disabled = false;
      (saveBtn as HTMLButtonElement).textContent = '保存设置'
    }
  }

  openBtn?.addEventListener('click', openSettings)
  closeBtn?.addEventListener('click', closeSettings)
  saveBtn?.addEventListener('click', saveSettingsHandler)

  // Switch config display when provider changes
  providerSelect?.addEventListener('change', () => {
    if (!currentSettings) return
    const provider = providerSelect.value as Provider
    const config = currentSettings.configs[provider]
    const defaults = PROVIDER_DEFAULTS[provider]

    if (config) {
      apiKeyInput.value = config.apiKey || ''
      baseUrlInput.value = config.baseUrl || ''
      modelInput.value = config.model
    } else {
      // Default fallback if no config exists yet (shouldn't happen with correct usage)
      apiKeyInput.value = ''
      baseUrlInput.value = ''
    }
    
    baseUrlInput.placeholder = defaults.baseUrl || '官方默认地址'
  })


}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}
