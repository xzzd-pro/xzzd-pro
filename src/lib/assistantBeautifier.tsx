/**
 * Assistant Beautifier - Main Entry Point (Refactored)
 *
 * This module serves as the main entry point for the learning assistant overlay.
 * It has been refactored to use modular architecture:
 * - Styles: src/assistant/styles/overlayStyles.css
 * - Utils: src/assistant/utils/
 * - Handlers: src/assistant/handlers/
 */

import { renderAssistantPage } from '../assistant/components/assistantPageHelpers'
import { Storage } from "@plasmohq/storage"
import type { AssistantSettings, ChatMessage, CourseInfo, MaterialFile } from '../assistant/types'

// Import handlers
import {
  setOverlayElement,
  setCurrentSettings,
  setCurrentCourseId,
  setCurrentCourseName,
  setCourses,
  initAssistant,
  switchCourse,
  clearSelectedCourseMaterials
} from '../assistant/handlers/courseHandler'

import { setupSettingsHandlers, setOverlayElement as setSettingsOverlayElement } from '../assistant/handlers/settingsHandler'
import { setupChatHandlers, setMessages, setOverlayElement as setChatOverlayElement } from '../assistant/handlers/chatHandler'
import { renderMessages, setOverlayElement as setUiUtilsOverlayElement } from '../assistant/utils/uiUtils'

// Import CSS content
import { overlayStyles } from '../assistant/styles/overlayStyles'

// Global State
let currentSettings: AssistantSettings | null = null
let currentCourseId: string | null = null
let currentCourseName: string = ''
let isGenerating: boolean = false
let courses: CourseInfo[] = []
let messages: ChatMessage[] = []
let pendingAttachments: File[] = []
const selectedCourseMaterials = new Map<string, { file: MaterialFile; materialTitle: string }>()
let overlayHost: HTMLElement | null = null
let overlayElement: HTMLElement | null = null
let isFlashcardMode = false
let isFlashcardSplitView = false
let isSplitTransitioning = false
let externalSplitToggleHandler: ((event: Event) => void) | null = null
let externalClearHistoryHandler: ((event: Event) => void) | null = null
let externalMaterialToggleHandler: ((event: Event) => void) | null = null

// Export state getters/setters for handlers
export function getOverlayElement(): HTMLElement | null {
  return overlayElement
}

export function getOverlayHost(): HTMLElement | null {
  return overlayHost
}

export function setGenerating(value: boolean): void {
  isGenerating = value
}

export function getGenerating(): boolean {
  return isGenerating
}

export function getIsFlashcardMode(): boolean {
  return isFlashcardMode
}

export function setIsFlashcardMode(value: boolean): void {
  isFlashcardMode = value
}

export function getIsFlashcardSplitView(): boolean {
  return isFlashcardSplitView
}

export function setIsFlashcardSplitView(value: boolean): void {
  isFlashcardSplitView = value
}

export function getIsSplitTransitioning(): boolean {
  return isSplitTransitioning
}

export function setIsSplitTransitioning(value: boolean): void {
  isSplitTransitioning = value
}

export function getPendingAttachments(): File[] {
  return pendingAttachments
}

export function setPendingAttachments(files: File[]): void {
  pendingAttachments = files
}

export function getCurrentSettings(): AssistantSettings | null {
  return currentSettings
}

export function setCurrentSettingsState(settings: AssistantSettings | null): void {
  currentSettings = settings
  setCurrentSettings(settings)
}

export function getCurrentCourseId(): string | null {
  return currentCourseId
}

export function setCurrentCourseIdState(id: string | null): void {
  currentCourseId = id
  setCurrentCourseId(id)
}

export function getCurrentCourseName(): string {
  return currentCourseName
}

export function setCurrentCourseNameState(name: string): void {
  currentCourseName = name
  setCurrentCourseName(name)
}

export function getCourses(): CourseInfo[] {
  return courses
}

export function setCoursesState(newCourses: CourseInfo[]): void {
  courses = newCourses
  setCourses(newCourses)
}

export function getSelectedCourseMaterialsMap(): Map<string, { file: MaterialFile; materialTitle: string }> {
  return selectedCourseMaterials
}

export function clearSelectedMaterials(): void {
  selectedCourseMaterials.clear()
  clearSelectedCourseMaterials()
}

export function getMessagesState(): ChatMessage[] {
  return messages
}

export function setMessagesState(newMessages: ChatMessage[]): void {
  messages = newMessages
  setMessages(newMessages)
}

// Event handlers export for cleanup
export function getExternalSplitToggleHandler(): ((event: Event) => void) | null {
  return externalSplitToggleHandler
}

export function setExternalSplitToggleHandler(handler: ((event: Event) => void) | null): void {
  externalSplitToggleHandler = handler
}

export function getExternalClearHistoryHandler(): ((event: Event) => void) | null {
  return externalClearHistoryHandler
}

export function setExternalClearHistoryHandler(handler: ((event: Event) => void) | null): void {
  externalClearHistoryHandler = handler
}

export function getExternalMaterialToggleHandler(): ((event: Event) => void) | null {
  return externalMaterialToggleHandler
}

export function setExternalMaterialToggleHandler(handler: ((event: Event) => void) | null): void {
  externalMaterialToggleHandler = handler
}

// Main functions
export function isAssistantOpen(): boolean {
  return overlayHost !== null && document.body.contains(overlayHost)
}

export function closeAssistant(): void {
  if (externalSplitToggleHandler) {
    window.removeEventListener('xzzd:assistant-toggle-flashcard', externalSplitToggleHandler)
    externalSplitToggleHandler = null
  }
  if (externalClearHistoryHandler) {
    window.removeEventListener('xzzd:assistant-clear-history', externalClearHistoryHandler)
    externalClearHistoryHandler = null
  }
  if (externalMaterialToggleHandler) {
    window.removeEventListener('xzzd:assistant-material-toggle', externalMaterialToggleHandler)
    externalMaterialToggleHandler = null
  }
  if (overlayHost && document.body.contains(overlayHost)) {
    overlayHost.remove()
    overlayHost = null
    overlayElement = null
    setOverlayElement(null)
    document.body.style.overflow = ''
  }
}

// Helper to inject styles
function injectOverlayStyles(root: ShadowRoot): void {
  const style = document.createElement('style')
  // Handle both string and object exports from CSS import
  const cssContent = typeof overlayStyles === 'string' ? overlayStyles : (overlayStyles as any)?.default || String(overlayStyles || '')
  console.log('XZZDPRO: Injecting CSS, length:', cssContent.length)
  style.textContent = cssContent
  root.appendChild(style)
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

  // Inject Styles into Shadow DOM
  injectOverlayStyles(shadow)

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
  setOverlayElement(overlayElement)
  setChatOverlayElement(overlayElement)
  setSettingsOverlayElement(overlayElement)
  setUiUtilsOverlayElement(overlayElement)

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
  overlayHost.style.zIndex = '2147483647'
  overlayHost.style.top = '0'
  overlayHost.style.left = '0'
  overlayHost.style.width = '0'
  overlayHost.style.height = '0'

  // Create Shadow Root
  const shadow = overlayHost.attachShadow({ mode: 'open' })

  // Inject Styles into Shadow DOM
  injectOverlayStyles(shadow)

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

  // Update global reference
  setOverlayElement(overlayElement)
  setChatOverlayElement(overlayElement)
  setSettingsOverlayElement(overlayElement)
  setUiUtilsOverlayElement(overlayElement)

  // Close button handler
  const closeBtn = overlayElement.querySelector('#assistant-close-btn')
  closeBtn?.addEventListener('click', () => {
    closeAssistant()
  })

  // Backdrop click handler
  const backdrop = overlayElement.querySelector('.assistant-overlay-backdrop')
  backdrop?.addEventListener('click', () => {
    closeAssistant()
  })

  // ESC key handler
  document.addEventListener('keydown', handleEscClose)

  // Apply theme
  const storage = new Storage()
  const theme = await storage.get('theme') || 'light'
  overlayHost.setAttribute('data-theme', theme)

  // Watch for theme changes
  storage.watch({
    theme: (change) => {
      if (overlayHost) overlayHost.setAttribute('data-theme', change.newValue || 'light')
    }
  })

  // Add to body
  document.body.appendChild(overlayHost)

  // Initialize
  await initAssistant()
}

function handleEscClose(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (isAssistantOpen()) {
      closeAssistant()
      document.removeEventListener('keydown', handleEscClose)
    }
  }
}

// Re-export from handlers for backward compatibility
export { initAssistant, switchCourse, renderMessages }
export { setupSettingsHandlers, setupChatHandlers }
export { renderChatMessage, renderAttachmentCard } from '../assistant/components/assistantPageHelpers'
export { hydrateFlashcardBubbles } from '../assistant/components/flashcardRenderer'
