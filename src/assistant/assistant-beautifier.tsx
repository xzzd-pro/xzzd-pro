/**
 * Assistant Beautifier - Main Entry Point (Refactored)
 *
 * This module serves as the main entry point for the learning assistant overlay.
 * It has been refactored to use modular architecture:
 * - Styles: src/assistant/styles/overlay-styles.css
 * - Utils: src/assistant/utils/
 * - Handlers: src/assistant/handlers/
 */

import { storage } from "@/lib/storage"

import { renderAssistantPage } from "../assistant/components/assistant-page-helpers"
import {
  setOverlayElement as setChatOverlayElement,
  setMessages,
  setupChatHandlers
} from "../assistant/handlers/chat-handler"
import {
  clearSelectedCourseMaterials,
  initAssistant,
  setCourses,
  setCurrentCourseId,
  setCurrentCourseName,
  setCurrentSettings,
  setOverlayElement,
  switchCourse
} from "../assistant/handlers/course-handler"
import {
  setOverlayElement as setSettingsOverlayElement,
  setupSettingsHandlers
} from "../assistant/handlers/settings-handler"
import { OVERLAY_STYLES } from "../assistant/styles/overlay-styles"
import type {
  AssistantSettings,
  ChatMessage,
  CourseInfo,
  MaterialFile
} from "../assistant/types"
import {
  renderMessages,
  setOverlayElement as setUiUtilsOverlayElement
} from "../assistant/utils/ui-utils"

// Global State
let currentSettings: AssistantSettings | null = null
let currentCourseId: string | null = null
let currentCourseName: string = ""
let isGenerating: boolean = false
let courses: CourseInfo[] = []
let messages: ChatMessage[] = []
let pendingAttachments: File[] = []
const selectedCourseMaterials = new Map<
  string,
  { file: MaterialFile; materialTitle: string }
>()
let overlayHost: HTMLElement | null = null
let overlayElement: HTMLElement | null = null
let isFlashcardMode = false
let isFlashcardSplitView = false
let isSplitTransitioning = false
let externalSplitToggleHandler: ((event: Event) => void) | null = null
let externalClearHistoryHandler: ((event: Event) => void) | null = null
let externalMaterialToggleHandler: ((event: Event) => void) | null = null

// Export state getters/setters for handlers
/**
 * Returns the assistant's root container inside the shadow DOM.
 * @returns The container element, or null when the assistant is not mounted.
 */
export function getOverlayElement(): HTMLElement | null {
  return overlayElement
}

/**
 * Returns the host element that carries the assistant's shadow root.
 * @returns The host element, or null when the overlay is closed.
 */
export function getOverlayHost(): HTMLElement | null {
  return overlayHost
}

/**
 * Marks whether a model response is currently being generated.
 * @param value True while a response is streaming.
 */
export function setGenerating(value: boolean): void {
  isGenerating = value
}

/**
 * @returns True while a model response is being generated.
 */
export function getGenerating(): boolean {
  return isGenerating
}

/**
 * @returns True when the assistant is in flashcard mode.
 */
export function getIsFlashcardMode(): boolean {
  return isFlashcardMode
}

/**
 * Switches flashcard mode on or off.
 * @param value True to enable flashcard mode.
 */
export function setIsFlashcardMode(value: boolean): void {
  isFlashcardMode = value
}

/**
 * @returns True when the flashcard panel is shown beside the chat.
 */
export function getIsFlashcardSplitView(): boolean {
  return isFlashcardSplitView
}

/**
 * Shows or hides the flashcard panel beside the chat.
 * @param value True to show the split view.
 */
export function setIsFlashcardSplitView(value: boolean): void {
  isFlashcardSplitView = value
}

/**
 * @returns True while the split-view animation is running.
 */
export function getIsSplitTransitioning(): boolean {
  return isSplitTransitioning
}

/**
 * Records whether the split-view animation is running, so input can be ignored meanwhile.
 * @param value True while the animation runs.
 */
export function setIsSplitTransitioning(value: boolean): void {
  isSplitTransitioning = value
}

/**
 * @returns Files the user attached that have not been sent yet.
 */
export function getPendingAttachments(): File[] {
  return pendingAttachments
}

/**
 * Replaces the list of files waiting to be sent.
 * @param files Files attached in the composer.
 */
export function setPendingAttachments(files: File[]): void {
  pendingAttachments = files
}

/**
 * @returns The loaded assistant settings, or null before they are loaded.
 */
export function getCurrentSettings(): AssistantSettings | null {
  return currentSettings
}

/**
 * Stores the assistant settings here and in the course handler.
 * @param settings Settings to use, or null to clear them.
 */
export function setCurrentSettingsState(
  settings: AssistantSettings | null
): void {
  currentSettings = settings
  setCurrentSettings(settings)
}

/**
 * @returns The id of the course the assistant is talking about, or null.
 */
export function getCurrentCourseId(): string | null {
  return currentCourseId
}

/**
 * Sets the active course id here and in the course handler.
 * @param id Course id, or null when no course is selected.
 */
export function setCurrentCourseIdState(id: string | null): void {
  currentCourseId = id
  setCurrentCourseId(id)
}

/**
 * @returns The display name of the active course.
 */
export function getCurrentCourseName(): string {
  return currentCourseName
}

/**
 * Sets the active course name here and in the course handler.
 * @param name Display name of the course.
 */
export function setCurrentCourseNameState(name: string): void {
  currentCourseName = name
  setCurrentCourseName(name)
}

/**
 * @returns Courses the user can pick in the assistant.
 */
export function getCourses(): CourseInfo[] {
  return courses
}

/**
 * Replaces the course list here and in the course handler.
 * @param newCourses Courses available to the assistant.
 */
export function setCoursesState(newCourses: CourseInfo[]): void {
  courses = newCourses
  setCourses(newCourses)
}

/**
 * @returns Materials the user selected as context, keyed by selection key.
 */
export function getSelectedCourseMaterialsMap(): Map<
  string,
  { file: MaterialFile; materialTitle: string }
> {
  return selectedCourseMaterials
}

/**
 * Clears the selected materials here and in the course handler.
 */
export function clearSelectedMaterials(): void {
  selectedCourseMaterials.clear()
  clearSelectedCourseMaterials()
}

/**
 * @returns Messages of the current chat session.
 */
export function getMessagesState(): ChatMessage[] {
  return messages
}

/**
 * Replaces the chat messages here and in the chat handler, which re-renders them.
 * @param newMessages Messages to show.
 */
export function setMessagesState(newMessages: ChatMessage[]): void {
  messages = newMessages
  setMessages(newMessages)
}

// Event handlers export for cleanup
/**
 * @returns The window listener that toggles the flashcard split view, if registered.
 */
export function getExternalSplitToggleHandler():
  | ((event: Event) => void)
  | null {
  return externalSplitToggleHandler
}

/**
 * Remembers the flashcard split-view listener so it can be removed on close.
 * @param handler The listener, or null once removed.
 */
export function setExternalSplitToggleHandler(
  handler: ((event: Event) => void) | null
): void {
  externalSplitToggleHandler = handler
}

/**
 * @returns The window listener that clears chat history, if registered.
 */
export function getExternalClearHistoryHandler():
  | ((event: Event) => void)
  | null {
  return externalClearHistoryHandler
}

/**
 * Remembers the clear-history listener so it can be removed on close.
 * @param handler The listener, or null once removed.
 */
export function setExternalClearHistoryHandler(
  handler: ((event: Event) => void) | null
): void {
  externalClearHistoryHandler = handler
}

/**
 * @returns The window listener that toggles a course material, if registered.
 */
export function getExternalMaterialToggleHandler():
  | ((event: Event) => void)
  | null {
  return externalMaterialToggleHandler
}

/**
 * Remembers the material-toggle listener so it can be removed on close.
 * @param handler The listener, or null once removed.
 */
export function setExternalMaterialToggleHandler(
  handler: ((event: Event) => void) | null
): void {
  externalMaterialToggleHandler = handler
}

// Main functions
/**
 * @returns True when the floating assistant overlay is attached to the page.
 */
export function isAssistantOpen(): boolean {
  return overlayHost !== null && document.body.contains(overlayHost)
}

/**
 * Closes the floating assistant: removes its window listeners and overlay, and restores page scrolling.
 */
export function closeAssistant(): void {
  if (externalSplitToggleHandler) {
    window.removeEventListener(
      "xzzd:assistant-toggle-flashcard",
      externalSplitToggleHandler
    )
    externalSplitToggleHandler = null
  }
  if (externalClearHistoryHandler) {
    window.removeEventListener(
      "xzzd:assistant-clear-history",
      externalClearHistoryHandler
    )
    externalClearHistoryHandler = null
  }
  if (externalMaterialToggleHandler) {
    window.removeEventListener(
      "xzzd:assistant-material-toggle",
      externalMaterialToggleHandler
    )
    externalMaterialToggleHandler = null
  }
  if (overlayHost && document.body.contains(overlayHost)) {
    overlayHost.remove()
    overlayHost = null
    overlayElement = null
    setOverlayElement(null)
    document.body.style.overflow = ""
  }
}

// Helper to inject styles
function injectOverlayStyles(root: ShadowRoot): void {
  const style = document.createElement("style")
  // Handle both string and object exports from CSS import
  const cssContent =
    typeof OVERLAY_STYLES === "string"
      ? OVERLAY_STYLES
      : (OVERLAY_STYLES as any)?.default || String(OVERLAY_STYLES || "")
  console.log("XZZDPRO: Injecting CSS, length:", cssContent.length)
  style.textContent = cssContent
  root.appendChild(style)
}

// Factory function to create the assistant host element
/**
 * Builds the assistant embedded in the AI page: a host element with a closed shadow root, styles and the chat UI, then initializes course data.
 * @returns The host element, ready to be inserted into the page.
 */
export async function createAssistantHost(): Promise<HTMLElement> {
  const host = document.createElement("div")
  host.id = "xzzdpro-assistant-embedded-host"
  host.style.width = "100%"
  host.style.height = "100%"
  host.style.overflow = "hidden"

  // Closed so host-page scripts can't reach the assistant UI via element.shadowRoot
  const shadow = host.attachShadow({ mode: "closed" })

  injectOverlayStyles(shadow)

  overlayElement = document.createElement("div")
  overlayElement.className = "assistant-fullpage"
  overlayElement.innerHTML = `
    <div class="assistant-content-container">
      ${renderAssistantPage("")}
    </div>
  `

  shadow.appendChild(overlayElement)

  overlayHost = host
  setOverlayElement(overlayElement)
  setChatOverlayElement(overlayElement)
  setSettingsOverlayElement(overlayElement)
  setUiUtilsOverlayElement(overlayElement)

  const theme = (await storage.get("theme")) || "light"
  host.setAttribute("data-theme", theme)

  // Watch for theme changes
  storage.watch({
    theme: (change) => {
      if (host) host.setAttribute("data-theme", change.newValue || "light")
    }
  })

  // Start initialization but don't wait for it to return the element
  initAssistant().catch((err) =>
    console.error("XZZDPRO: Async init failed", err)
  )

  return host
}

/**
 * Opens the floating assistant overlay, or closes it if it is already open.
 */
export async function openAssistant(): Promise<void> {
  console.log("XZZDPRO: openAssistant called")
  if (isAssistantOpen()) {
    console.log("XZZDPRO: Assistant already open, closing")
    closeAssistant()
    return
  }

  document.body.style.overflow = "hidden"

  overlayHost = document.createElement("div")
  overlayHost.id = "xzzdpro-assistant-host"
  overlayHost.style.position = "fixed"
  overlayHost.style.zIndex = "2147483647"
  overlayHost.style.top = "0"
  overlayHost.style.left = "0"
  overlayHost.style.width = "0"
  overlayHost.style.height = "0"

  // Closed so host-page scripts can't reach the assistant UI via element.shadowRoot
  const shadow = overlayHost.attachShadow({ mode: "closed" })

  injectOverlayStyles(shadow)

  overlayElement = document.createElement("div")
  overlayElement.className = "assistant-overlay"
  overlayElement.innerHTML = `
    <div class="assistant-overlay-backdrop"></div>
    <div class="assistant-overlay-container">
      <div class="assistant-overlay-header">
        <h2>学习助理</h2>
        <button class="assistant-close-btn" id="assistant-close-btn">&times;</button>
      </div>
      <div class="assistant-overlay-content">
        ${renderAssistantPage("")}
      </div>
    </div>
  `

  shadow.appendChild(overlayElement)

  setOverlayElement(overlayElement)
  setChatOverlayElement(overlayElement)
  setSettingsOverlayElement(overlayElement)
  setUiUtilsOverlayElement(overlayElement)

  const closeBtn = overlayElement.querySelector("#assistant-close-btn")
  closeBtn?.addEventListener("click", () => {
    closeAssistant()
  })

  // Backdrop click handler
  const backdrop = overlayElement.querySelector(".assistant-overlay-backdrop")
  backdrop?.addEventListener("click", () => {
    closeAssistant()
  })

  // ESC key handler
  document.addEventListener("keydown", handleEscClose)

  const theme = (await storage.get("theme")) || "light"
  overlayHost.setAttribute("data-theme", theme)

  // Watch for theme changes
  storage.watch({
    theme: (change) => {
      if (overlayHost)
        overlayHost.setAttribute("data-theme", change.newValue || "light")
    }
  })

  document.body.appendChild(overlayHost)

  await initAssistant()
}

function handleEscClose(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    if (isAssistantOpen()) {
      closeAssistant()
      document.removeEventListener("keydown", handleEscClose)
    }
  }
}

// Re-export from handlers for backward compatibility
export { initAssistant, switchCourse, renderMessages }
export { setupSettingsHandlers, setupChatHandlers }
export {
  renderChatMessage,
  renderAttachmentCard
} from "../assistant/components/assistant-page-helpers"
export { hydrateFlashcardBubbles } from "../assistant/components/flashcard-renderer"
