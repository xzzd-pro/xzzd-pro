/**
 * Course Handler - Manages course switching, initialization, and sidebar synchronization
 */
import { preloadCourseContext } from "../services/context-builder"
import {
  buildCourseContext,
  fetchAllCourses
} from "../services/course-data-service"
import { loadChatHistory, loadSettings } from "../storage"
import type {
  AssistantSettings,
  CourseContext,
  CourseInfo,
  MaterialFile
} from "../types"
import { renderMessages, showStatus } from "../utils/ui-utils"
import { setupChatHandlers } from "./chat-handler"
import { setupSettingsHandlers } from "./settings-handler"

type SelectedMaterial = {
  file: MaterialFile
  materialTitle: string
}

// State references (will be set via setter functions)
let overlayElement: HTMLElement | null = null
let currentSettings: AssistantSettings | null = null
let currentCourseId: string | null = null
let currentCourseName: string = ""
let courses: CourseInfo[] = []
const selectedCourseMaterials = new Map<string, SelectedMaterial>()

function normalizeMaterialUrl(downloadUrl: string): string {
  const raw = (downloadUrl || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "")
  } catch {
    return raw.split("?")[0].split("#")[0].replace(/\/+$/, "")
  }
}

function extractUploadId(value: string): string | null {
  const normalized = normalizeMaterialUrl(value)
  const match = normalized.match(/\/uploads\/(\d+)\/blob$/)
  return match?.[1] || null
}

/**
 * Builds the key used to track a selected material, so the same file matches across URL variants.
 * @param downloadUrl Download URL of the file.
 * @returns Normalized URL used as the key.
 */
export function getMaterialSelectionKey(downloadUrl: string): string {
  return normalizeMaterialUrl(downloadUrl)
}

// Setter functions for state management
/**
 * Sets the assistant container that course handlers query.
 * @param element The container, or null when the assistant is unmounted.
 */
export function setOverlayElement(element: HTMLElement | null): void {
  overlayElement = element
}

/**
 * Stores the assistant settings used when switching courses.
 * @param settings Loaded settings, or null.
 */
export function setCurrentSettings(settings: AssistantSettings | null): void {
  currentSettings = settings
}

/**
 * @returns The assistant settings, or null before they are loaded.
 */
export function getCurrentSettings(): AssistantSettings | null {
  return currentSettings
}

/**
 * Sets the active course id without loading anything.
 * @param courseId Course id, or null.
 */
export function setCurrentCourseId(courseId: string | null): void {
  currentCourseId = courseId
}

/**
 * @returns The active course id, or null.
 */
export function getCurrentCourseId(): string | null {
  return currentCourseId
}

/**
 * Sets the active course name.
 * @param name Display name of the course.
 */
export function setCurrentCourseName(name: string): void {
  currentCourseName = name
}

/**
 * @returns The active course name.
 */
export function getCurrentCourseName(): string {
  return currentCourseName
}

/**
 * Replaces the list of courses available to the assistant.
 * @param newCourses Courses to offer.
 */
export function setCourses(newCourses: CourseInfo[]): void {
  courses = newCourses
}

/**
 * @returns Courses available to the assistant.
 */
export function getCourses(): CourseInfo[] {
  return courses
}

/**
 * @returns Materials the user selected as context, keyed by selection key.
 */
export function getSelectedCourseMaterials(): Map<string, SelectedMaterial> {
  return selectedCourseMaterials
}

/**
 * Clears the selected materials.
 */
export function clearSelectedCourseMaterials(): void {
  selectedCourseMaterials.clear()
}

function getInitialCourseIdFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get("courseId")
  } catch (error) {
    console.error("XZZDPRO: Failed to parse courseId from URL", error)
    return null
  }
}

/**
 * Highlights the course in the sidebar submenu.
 * @param courseId Id of the course to highlight.
 */
export function syncSidebarCourseActive(courseId: string): void {
  document.querySelectorAll(".course-submenu-item").forEach((el) => {
    if (!(el instanceof HTMLElement)) return
    if (el.getAttribute("data-course-id") === courseId) {
      el.classList.add("active")
    } else {
      el.classList.remove("active")
    }
  })
}

/**
 * Listens for course picks from the sidebar and switches the assistant to that course.
 */
export function bindSidebarCourseSelection(): void {
  const handleCourseSelect = (event: Event) => {
    const customEvent = event as CustomEvent<{ courseId?: string }>
    const courseId = customEvent.detail?.courseId
    if (!courseId) return
    void switchCourse(courseId)
  }

  window.removeEventListener(
    "xzzd:assistant-course-select",
    handleCourseSelect as EventListener
  )
  window.addEventListener(
    "xzzd:assistant-course-select",
    handleCourseSelect as EventListener
  )
}

/**
 * Keeps only the materials the user selected, matched by URL or upload id.
 * @param context Full course context.
 * @returns The context unchanged when nothing is selected, otherwise a filtered copy.
 */
export function filterContextBySelectedMaterials(
  context: CourseContext
): CourseContext {
  if (selectedCourseMaterials.size === 0) {
    return context
  }

  const selectedByUrl = new Set<string>()
  const selectedByUploadId = new Set<string>()

  selectedCourseMaterials.forEach(({ file }, selectionKey) => {
    const normalizedKey = normalizeMaterialUrl(
      selectionKey || file.downloadUrl || ""
    )
    if (normalizedKey) {
      selectedByUrl.add(normalizedKey)
    }
    const uploadId = extractUploadId(normalizedKey || file.downloadUrl || "")
    if (uploadId) {
      selectedByUploadId.add(uploadId)
    }
    if (Number.isFinite(Number(file.id))) {
      selectedByUploadId.add(String(file.id))
    }
  })

  const filteredMaterials = context.materials
    .map((material) => {
      const filteredFiles = (material.files || []).filter((file) => {
        const normalizedUrl = normalizeMaterialUrl(file.downloadUrl || "")
        if (normalizedUrl && selectedByUrl.has(normalizedUrl)) {
          return true
        }
        const uploadId = extractUploadId(
          normalizedUrl || file.downloadUrl || ""
        )
        if (uploadId && selectedByUploadId.has(uploadId)) {
          return true
        }
        return (
          Number.isFinite(Number(file.id)) &&
          selectedByUploadId.has(String(file.id))
        )
      })
      return {
        ...material,
        files: filteredFiles
      }
    })
    .filter((material) => (material.files || []).length > 0)

  return {
    ...context,
    materials: filteredMaterials
  }
}

/**
 * Downloads and caches a newly selected material so the next question does not wait for it.
 * @param file The selected file.
 * @param materialTitle Title of the material it belongs to.
 */
export async function preloadSelectedMaterial(
  file: MaterialFile,
  materialTitle: string
): Promise<void> {
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

  await preloadCourseContext(context, (msg, type) =>
    showStatus(msg, type || "info")
  )
}

/**
 * Loads settings and courses, binds the settings, chat and sidebar handlers, and opens the course from the URL if given.
 */
export async function initAssistant(): Promise<void> {
  try {
    currentSettings = await loadSettings()
    courses = await fetchAllCourses()

    bindSidebarCourseSelection()

    setupSettingsHandlers(
      () => currentSettings,
      (settings) => {
        currentSettings = settings
      }
    )
    setupChatHandlers()

    const initialCourseId = getInitialCourseIdFromUrl()
    if (initialCourseId) {
      await switchCourse(initialCourseId)
    }
  } catch (error) {
    console.error("XZZDPRO: Failed to init assistant", error)
  }
}

/**
 * Makes a course active: updates the URL and sidebar, clears selected materials, and loads that course's chat history.
 * @param courseId Id of the course to open; does nothing if it is already active or unknown.
 */
export async function switchCourse(courseId: string): Promise<void> {
  if (currentCourseId === courseId) return

  currentCourseId = courseId
  const course = courses.find((c) => String(c.id) === courseId)
  if (!course) return

  try {
    const url = new URL(window.location.href)
    url.searchParams.set("courseId", courseId)
    window.history.replaceState({}, "", url.toString())
  } catch (error) {
    console.error("XZZDPRO: Failed to sync courseId to URL", error)
  }

  currentCourseName = course.displayName
  selectedCourseMaterials.clear()
  syncSidebarCourseActive(courseId)
  window.dispatchEvent(
    new CustomEvent("xzzd:assistant-course-changed", {
      detail: { courseId }
    })
  )

  const chatInput = overlayElement?.querySelector(
    "#chat-input"
  ) as HTMLTextAreaElement
  const sendBtn = overlayElement?.querySelector(
    "#send-btn"
  ) as HTMLButtonElement
  const attachBtn = overlayElement?.querySelector(
    "#attach-btn"
  ) as HTMLButtonElement
  const flashcardSendBtn = overlayElement?.querySelector(
    "#flashcard-send-btn"
  ) as HTMLButtonElement
  const mindmapSendBtn = overlayElement?.querySelector(
    "#mindmap-send-btn"
  ) as HTMLButtonElement
  if (chatInput) chatInput.disabled = false
  if (sendBtn) sendBtn.disabled = false
  if (attachBtn) attachBtn.disabled = false
  if (flashcardSendBtn) flashcardSendBtn.disabled = false
  if (mindmapSendBtn) mindmapSendBtn.disabled = false

  const session = await loadChatHistory(courseId)
  const chatMessages = session?.messages || []
  // Note: messages are managed in chatHandler
  // We'll dispatch an event to update messages in chatHandler
  window.dispatchEvent(
    new CustomEvent("xzzd:assistant-messages-load", {
      detail: { messages: chatMessages }
    })
  )

  renderMessages(chatMessages, overlayElement)

  const subtitleEl = overlayElement?.querySelector(
    "#chat-course-subtitle"
  ) as HTMLElement
  if (subtitleEl) {
    subtitleEl.textContent = course.displayName
    subtitleEl.style.display = "block"
  }
}
