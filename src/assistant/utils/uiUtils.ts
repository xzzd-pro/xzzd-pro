/**
 * UI utility functions for the assistant
 */

import type { ChatMessage, FlashcardData, MindmapData } from '../types'
import { renderChatMessage } from '../components/assistantPageHelpers'
import { renderFlashcardBubble, hydrateFlashcardBubbles } from '../components/flashcardRenderer'
import { renderMindmapBubble, hydrateMindmapBubbles } from '../components/mindmapRenderer'

type ToolTab = 'flashcard' | 'mindmap'
const TOOL_TAB_STORAGE_KEY = 'xzzdpro:assistant-tool-tab:v1'
const DEFAULT_TOOL_TAB: ToolTab = 'flashcard'
const ASSISTANT_MODAL_ROOT_ID = 'assistant-modal-root'

// Global state references - will be injected
let overlayElementRef: HTMLElement | null = null
let messagesRef: ChatMessage[] = []
let statusTimeout: NodeJS.Timeout | null = null
let activeToolTab: ToolTab = DEFAULT_TOOL_TAB
let activeMindmapMessageId: string | null = null

interface AssistantPromptOptions {
  title: string
  value?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  maxLength?: number
}

interface AssistantConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

function escapeHtml(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const FLASHCARD_EMPTY_STATE_HTML = `
  <div class="empty-state">
    <div class="empty-state-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" aria-hidden="true">
        <path d="M4 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm2 0v12h10V5H6zm13 3h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-1h2v1h9v-9h-1V8z"/>
      </svg>
    </div>
    <h3>闪卡区域</h3>
    <p>生成闪卡后将在这里展示</p>
  </div>
`

const MINDMAP_EMPTY_STATE_HTML = `
  <div class="empty-state">
    <div class="empty-state-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" aria-hidden="true">
        <path d="M12 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM5 11a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm14 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 16a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-1-8v3H8v2h3v3h2v-3h3v-2h-3V8h-2Z"/>
      </svg>
    </div>
    <h3>导图区域</h3>
    <p>生成思维导图后将在这里展示</p>
  </div>
`

function loadStoredToolTab(): ToolTab {
  try {
    const value = globalThis.localStorage?.getItem(TOOL_TAB_STORAGE_KEY)
    if (value === 'flashcard' || value === 'mindmap') return value
  } catch {
    // Ignore storage errors in restricted contexts.
  }
  return DEFAULT_TOOL_TAB
}

function saveToolTab(tab: ToolTab): void {
  try {
    globalThis.localStorage?.setItem(TOOL_TAB_STORAGE_KEY, tab)
  } catch {
    // Ignore storage errors in restricted contexts.
  }
}

function applyToolTabState(overlayElement: HTMLElement | null = null): void {
  const el = overlayElement || overlayElementRef
  if (!el) return

  const flashcardTab = el.querySelector<HTMLButtonElement>('#tool-tab-flashcard')
  const mindmapTab = el.querySelector<HTMLButtonElement>('#tool-tab-mindmap')
  const flashcardContainer = el.querySelector<HTMLElement>('#flashcard-messages-container')
  const mindmapContainer = el.querySelector<HTMLElement>('#mindmap-messages-container')

  if (flashcardTab) {
    flashcardTab.classList.toggle('active', activeToolTab === 'flashcard')
    flashcardTab.setAttribute('aria-selected', activeToolTab === 'flashcard' ? 'true' : 'false')
  }

  if (mindmapTab) {
    mindmapTab.classList.toggle('active', activeToolTab === 'mindmap')
    mindmapTab.setAttribute('aria-selected', activeToolTab === 'mindmap' ? 'true' : 'false')
  }

  if (flashcardContainer) {
    flashcardContainer.style.display = activeToolTab === 'flashcard' ? 'flex' : 'none'
  }

  if (mindmapContainer) {
    mindmapContainer.style.display = activeToolTab === 'mindmap' ? 'flex' : 'none'
  }
}

function bindToolTabEvents(overlayElement: HTMLElement | null = null): void {
  const el = overlayElement || overlayElementRef
  if (!el) return

  const panel = el.querySelector<HTMLElement>('#flashcard-panel')
  if (!panel || panel.dataset.toolTabsReady === 'true') return

  const flashcardTab = el.querySelector<HTMLButtonElement>('#tool-tab-flashcard')
  const mindmapTab = el.querySelector<HTMLButtonElement>('#tool-tab-mindmap')

  flashcardTab?.addEventListener('click', () => {
    setActiveToolTab('flashcard', el)
  })

  mindmapTab?.addEventListener('click', () => {
    setActiveToolTab('mindmap', el)
  })

  panel.dataset.toolTabsReady = 'true'
}

export function getActiveToolTab(): ToolTab {
  return activeToolTab
}

export function setActiveToolTab(tab: ToolTab, overlayElement: HTMLElement | null = null): void {
  activeToolTab = tab
  saveToolTab(tab)
  applyToolTabState(overlayElement)
}

export function setOverlayElement(el: HTMLElement | null): void {
  overlayElementRef = el
  activeToolTab = loadStoredToolTab()
  bindToolTabEvents(el)
  applyToolTabState(el)
}

export function setMessagesRef(msgs: ChatMessage[]): void {
  messagesRef = msgs
}

export function getActiveMindmapMessageId(): string | null {
  return activeMindmapMessageId
}

export function setActiveMindmapMessageId(messageId: string | null): void {
  activeMindmapMessageId = messageId
}

export function adjustTextareaHeight(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  el.style.height = (el.scrollHeight) + 'px'
}

export function showStatus(
  message: string,
  type: 'success' | 'error' | 'info' = 'info',
  overlayElement: HTMLElement | null = null
): void {
  const el = overlayElement || overlayElementRef
  let toast = el?.querySelector('#status-toast') as HTMLElement
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'status-toast'
    toast.className = 'status-toast'
    const chatArea = el?.querySelector('.chat-area') || el?.querySelector('.assistant-overlay-container') || el
    if (chatArea) {
      chatArea.appendChild(toast)
    }
  }

  // Icon handling
  let icon = ''
  if (type === 'success') {
    icon = '<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
  } else if (type === 'error') {
    icon = '<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
  } else {
    icon = '<span class="toast-spinner"></span>'
  }

  toast.className = `status-toast ${type}`
  toast.innerHTML = `${icon}<span>${message}</span>`
  toast.classList.add('show')

  if (statusTimeout) {
    clearTimeout(statusTimeout)
  }

  statusTimeout = setTimeout(() => {
    toast.classList.remove('show')
  }, 3000)
}

export function scrollToBottom(overlayElement: HTMLElement | null = null): void {
  const el = overlayElement || overlayElementRef
  const container = el?.querySelector('#messages-container')
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

function getModalRoot(overlayElement: HTMLElement | null = null): HTMLElement {
  const host = overlayElement || overlayElementRef || document.body
  let root = host.querySelector<HTMLElement>(`#${ASSISTANT_MODAL_ROOT_ID}`)
  if (!root) {
    root = document.createElement('div')
    root.id = ASSISTANT_MODAL_ROOT_ID
    root.className = 'assistant-modal-root'
    host.appendChild(root)
  }
  return root
}

function closeModal(overlay: HTMLElement): void {
  overlay.remove()
}

export function openAssistantPrompt(options: AssistantPromptOptions, overlayElement: HTMLElement | null = null): Promise<string | null> {
  const root = getModalRoot(overlayElement)
  const overlay = document.createElement('div')
  overlay.className = 'assistant-modal-overlay'
  const title = options.title || '请输入内容'
  const confirmText = options.confirmText || '确认'
  const cancelText = options.cancelText || '取消'
  const initialValue = options.value || ''
  const placeholder = options.placeholder || ''
  const maxLength = options.maxLength || 60

  overlay.innerHTML = `
    <div class="assistant-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="assistant-modal-header">${escapeHtml(title)}</div>
      <div class="assistant-modal-body">
        <input class="assistant-modal-input" type="text" value="${escapeHtml(initialValue)}" placeholder="${escapeHtml(placeholder)}" maxlength="${maxLength}" />
      </div>
      <div class="assistant-modal-footer">
        <button type="button" class="assistant-modal-btn" data-action="cancel">${escapeHtml(cancelText)}</button>
        <button type="button" class="assistant-modal-btn primary" data-action="confirm">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `
  root.appendChild(overlay)

  return new Promise((resolve) => {
    const input = overlay.querySelector<HTMLInputElement>('.assistant-modal-input')
    const cancelBtn = overlay.querySelector<HTMLButtonElement>('[data-action="cancel"]')
    const confirmBtn = overlay.querySelector<HTMLButtonElement>('[data-action="confirm"]')

    const done = (value: string | null) => {
      closeModal(overlay)
      resolve(value)
    }

    cancelBtn?.addEventListener('click', () => done(null))
    confirmBtn?.addEventListener('click', () => done(input?.value ?? ''))
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) done(null)
    })
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        done(null)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        done(input?.value ?? '')
      }
    })

    window.setTimeout(() => {
      input?.focus()
      input?.select()
    }, 0)
  })
}

export function openAssistantConfirm(options: AssistantConfirmOptions, overlayElement: HTMLElement | null = null): Promise<boolean> {
  const root = getModalRoot(overlayElement)
  const overlay = document.createElement('div')
  overlay.className = 'assistant-modal-overlay'
  const title = options.title || '请确认'
  const message = options.message || ''
  const confirmText = options.confirmText || '确认'
  const cancelText = options.cancelText || '取消'
  const confirmClass = options.danger ? 'assistant-modal-btn danger' : 'assistant-modal-btn primary'

  overlay.innerHTML = `
    <div class="assistant-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="assistant-modal-header">${escapeHtml(title)}</div>
      <div class="assistant-modal-body">
        <p class="assistant-modal-message">${escapeHtml(message)}</p>
      </div>
      <div class="assistant-modal-footer">
        <button type="button" class="assistant-modal-btn" data-action="cancel">${escapeHtml(cancelText)}</button>
        <button type="button" class="${confirmClass}" data-action="confirm">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `
  root.appendChild(overlay)

  return new Promise((resolve) => {
    const cancelBtn = overlay.querySelector<HTMLButtonElement>('[data-action="cancel"]')
    const confirmBtn = overlay.querySelector<HTMLButtonElement>('[data-action="confirm"]')

    const done = (confirmed: boolean) => {
      closeModal(overlay)
      resolve(confirmed)
    }

    cancelBtn?.addEventListener('click', () => done(false))
    confirmBtn?.addEventListener('click', () => done(true))
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) done(false)
    })
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        done(false)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        done(true)
      }
    })

    window.setTimeout(() => {
      confirmBtn?.focus()
    }, 0)
  })
}

export function renderMessages(
  messages: ChatMessage[] = messagesRef,
  overlayElement: HTMLElement | null = null
): void {
  const el = overlayElement || overlayElementRef
  const chatContainer = el?.querySelector('#messages-container')
  const flashcardContainer = el?.querySelector('#flashcard-messages-container')
  const mindmapContainer = el?.querySelector('#mindmap-messages-container')
  if (!chatContainer) return

  bindToolTabEvents(el)
  applyToolTabState(el)

  // Separate regular messages and track tool messages
  const chatMessages: ChatMessage[] = []
  let latestFlashcardData: FlashcardData | null = null
  let latestFlashcardMessageId: string | null = null
  const mindmapEntries: Array<{ id: string; data: MindmapData; title: string }> = []

  messages.forEach(msg => {
    if (msg.flashcards) {
      latestFlashcardData = msg.flashcards
      latestFlashcardMessageId = msg.id
    }
    if (msg.mindmap) {
      mindmapEntries.push({
        id: msg.id,
        data: msg.mindmap,
        title: (msg.mindmap.title || '学习导图').trim() || '学习导图'
      })
    }
    chatMessages.push(msg)
  })

  // Render chat messages (tool messages will show as tip bubbles when showToolContent is false)
  chatContainer.innerHTML = chatMessages.map(msg => renderChatMessage(msg, false)).join('')

  if (flashcardContainer) {
    flashcardContainer.innerHTML = latestFlashcardData && latestFlashcardMessageId
      ? renderFlashcardBubble(latestFlashcardData, latestFlashcardMessageId)
      : FLASHCARD_EMPTY_STATE_HTML
  }

  if (mindmapContainer) {
    if (mindmapEntries.length === 0) {
      activeMindmapMessageId = null
      mindmapContainer.innerHTML = MINDMAP_EMPTY_STATE_HTML
    } else {
      const hasActive = !!activeMindmapMessageId && mindmapEntries.some(entry => entry.id === activeMindmapMessageId)
      const resolvedActiveId = hasActive ? activeMindmapMessageId as string : mindmapEntries[mindmapEntries.length - 1].id
      activeMindmapMessageId = resolvedActiveId
      const activeEntry = mindmapEntries.find(entry => entry.id === resolvedActiveId) || mindmapEntries[mindmapEntries.length - 1]
      mindmapContainer.innerHTML = renderMindmapBubble(activeEntry.data, activeEntry.id, {
        options: mindmapEntries.map(entry => ({ id: entry.id, title: entry.title })),
        activeId: resolvedActiveId
      })
    }
  }

  hydrateFlashcardBubbles(chatContainer as HTMLElement)
  void hydrateMindmapBubbles(chatContainer as HTMLElement)
  if (flashcardContainer) {
    hydrateFlashcardBubbles(flashcardContainer as HTMLElement)
  }
  if (mindmapContainer) {
    void hydrateMindmapBubbles(mindmapContainer as HTMLElement)
  }
  scrollToBottom(el)
}
