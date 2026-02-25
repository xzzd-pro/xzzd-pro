/**
 * UI utility functions for the assistant
 */

import type { ChatMessage, FlashcardData } from '../types'
import { renderChatMessage } from '../components/assistantPageHelpers'
import { renderFlashcardBubble, hydrateFlashcardBubbles } from '../components/flashcardRenderer'

// Global state references - will be injected
let overlayElementRef: HTMLElement | null = null
let messagesRef: ChatMessage[] = []
let statusTimeout: NodeJS.Timeout | null = null

export function setOverlayElement(el: HTMLElement | null): void {
  overlayElementRef = el
}

export function setMessagesRef(msgs: ChatMessage[]): void {
  messagesRef = msgs
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

export function renderMessages(
  messages: ChatMessage[] = messagesRef,
  overlayElement: HTMLElement | null = null
): void {
  const el = overlayElement || overlayElementRef
  const chatContainer = el?.querySelector('#messages-container')
  const flashcardContainer = el?.querySelector('#flashcard-messages-container')
  if (!chatContainer) return

  // Separate regular messages and track flashcard messages
  const chatMessages: ChatMessage[] = []
  let latestFlashcardData: FlashcardData | null = null
  let latestFlashcardMessageId: string | null = null

  messages.forEach(msg => {
    if (msg.flashcards) {
      latestFlashcardData = msg.flashcards
      latestFlashcardMessageId = msg.id
    }
    chatMessages.push(msg)
  })

  // Render chat messages (flashcard messages will show as tip bubbles when showFlashcard is false)
  chatContainer.innerHTML = chatMessages.map(msg => renderChatMessage(msg, false)).join('')

  // Render the latest flashcard to the left panel
  if (flashcardContainer && latestFlashcardData && latestFlashcardMessageId) {
    flashcardContainer.innerHTML = renderFlashcardBubble(latestFlashcardData, latestFlashcardMessageId)
  }

  hydrateFlashcardBubbles(chatContainer as HTMLElement)
  if (flashcardContainer) {
    hydrateFlashcardBubbles(flashcardContainer as HTMLElement)
  }
  scrollToBottom(el)
}
