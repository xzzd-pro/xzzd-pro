/**
 * Course Handler - Manages course switching, initialization, and sidebar synchronization
 */
import { loadSettings, loadChatHistory } from '../storage'
import { fetchAllCourses, buildCourseContext } from '../services/courseDataService'
import { preloadCourseContext } from '../services/contextBuilder'
import { showStatus, renderMessages } from '../utils/uiUtils'
import { setupSettingsHandlers } from './settingsHandler'
import { setupChatHandlers } from './chatHandler'
import type { CourseInfo, CourseContext, MaterialFile, AssistantSettings } from '../types'

// State references (will be set via setter functions)
let overlayElement: HTMLElement | null = null
let currentSettings: AssistantSettings | null = null
let currentCourseId: string | null = null
let currentCourseName: string = ''
let courses: CourseInfo[] = []
const selectedCourseMaterials = new Map<string, { file: MaterialFile; materialTitle: string }>()

// Setter functions for state management
export function setOverlayElement(element: HTMLElement | null): void {
  overlayElement = element
}

export function setCurrentSettings(settings: AssistantSettings | null): void {
  currentSettings = settings
}

export function getCurrentSettings(): AssistantSettings | null {
  return currentSettings
}

export function setCurrentCourseId(courseId: string | null): void {
  currentCourseId = courseId
}

export function getCurrentCourseId(): string | null {
  return currentCourseId
}

export function setCurrentCourseName(name: string): void {
  currentCourseName = name
}

export function getCurrentCourseName(): string {
  return currentCourseName
}

export function setCourses(newCourses: CourseInfo[]): void {
  courses = newCourses
}

export function getCourses(): CourseInfo[] {
  return courses
}

export function getSelectedCourseMaterials(): Map<string, { file: MaterialFile; materialTitle: string }> {
  return selectedCourseMaterials
}

export function clearSelectedCourseMaterials(): void {
  selectedCourseMaterials.clear()
}

function getInitialCourseIdFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('courseId')
  } catch (error) {
    console.error('XZZDPRO: Failed to parse courseId from URL', error)
    return null
  }
}

export function syncSidebarCourseActive(courseId: string): void {
  document.querySelectorAll('.course-submenu-item').forEach(el => {
    if (!(el instanceof HTMLElement)) return
    if (el.getAttribute('data-course-id') === courseId) {
      el.classList.add('active')
    } else {
      el.classList.remove('active')
    }
  })
}

export function bindSidebarCourseSelection(): void {
  const handleCourseSelect = (event: Event) => {
    const customEvent = event as CustomEvent<{ courseId?: string }>
    const courseId = customEvent.detail?.courseId
    if (!courseId) return
    void switchCourse(courseId)
  }

  window.removeEventListener('xzzd:assistant-course-select', handleCourseSelect as EventListener)
  window.addEventListener('xzzd:assistant-course-select', handleCourseSelect as EventListener)
}

export function filterContextBySelectedMaterials(context: CourseContext): CourseContext {
  if (selectedCourseMaterials.size === 0) {
    return {
      ...context,
      materials: []
    }
  }

  const selectedByUrl = new Map<string, MaterialFile>()
  selectedCourseMaterials.forEach(({ file }, downloadUrl) => {
    selectedByUrl.set(downloadUrl, file)
  })

  const filteredMaterials = context.materials
    .map((material) => {
      const filteredFiles = (material.files || []).filter(file => selectedByUrl.has(file.downloadUrl))
      return {
        ...material,
        files: filteredFiles
      }
    })
    .filter(material => (material.files || []).length > 0)

  return {
    ...context,
    materials: filteredMaterials
  }
}

export async function preloadSelectedMaterial(file: MaterialFile, materialTitle: string): Promise<void> {
  if (!currentCourseId) return

  const context: CourseContext = {
    courseId: currentCourseId,
    courseName: currentCourseName || `Course ${currentCourseId}`,
    materials: [
      {
        id: file.id,
        title: materialTitle,
        files: [file]
      }
    ],
    homeworks: []
  }

  await preloadCourseContext(context, (msg, type) => showStatus(msg, type || 'info'))
}

export async function initAssistant(): Promise<void> {
  try {
    currentSettings = await loadSettings()
    courses = await fetchAllCourses()

    bindSidebarCourseSelection()

    setupSettingsHandlers(
      () => currentSettings,
      (settings) => { currentSettings = settings }
    )
    setupChatHandlers()

    const initialCourseId = getInitialCourseIdFromUrl()
    if (initialCourseId) {
      await switchCourse(initialCourseId)
    }

  } catch (error) {
    console.error('XZZDPRO: Failed to init assistant', error)
  }
}

export async function switchCourse(courseId: string): Promise<void> {
  if (currentCourseId === courseId) return

  currentCourseId = courseId
  const course = courses.find(c => String(c.id) === courseId)
  if (!course) return

  try {
    const url = new URL(window.location.href)
    url.searchParams.set('courseId', courseId)
    window.history.replaceState({}, '', url.toString())
  } catch (error) {
    console.error('XZZDPRO: Failed to sync courseId to URL', error)
  }

  currentCourseName = course.displayName
  selectedCourseMaterials.clear()
  syncSidebarCourseActive(courseId)
  window.dispatchEvent(new CustomEvent('xzzd:assistant-course-changed', {
    detail: { courseId }
  }))

  // Enable inputs
  const chatInput = overlayElement?.querySelector('#chat-input') as HTMLTextAreaElement
  const sendBtn = overlayElement?.querySelector('#send-btn') as HTMLButtonElement
  const attachBtn = overlayElement?.querySelector('#attach-btn') as HTMLButtonElement
  const flashcardSendBtn = overlayElement?.querySelector('#flashcard-send-btn') as HTMLButtonElement
  const mindmapSendBtn = overlayElement?.querySelector('#mindmap-send-btn') as HTMLButtonElement
  if (chatInput) chatInput.disabled = false
  if (sendBtn) sendBtn.disabled = false
  if (attachBtn) attachBtn.disabled = false
  if (flashcardSendBtn) flashcardSendBtn.disabled = false
  if (mindmapSendBtn) mindmapSendBtn.disabled = false

  // Load history
  const session = await loadChatHistory(courseId)
  const chatMessages = session?.messages || []
  // Note: messages are managed in chatHandler
  // We'll dispatch an event to update messages in chatHandler
  window.dispatchEvent(new CustomEvent('xzzd:assistant-messages-load', {
    detail: { messages: chatMessages }
  }))

  renderMessages(chatMessages, overlayElement)

  // Update course subtitle
  const subtitleEl = overlayElement?.querySelector('#chat-course-subtitle') as HTMLElement
  if (subtitleEl) {
    subtitleEl.textContent = course.displayName
    subtitleEl.style.display = 'block'
  }
}
