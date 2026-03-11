/**
 * Chat Handler - Manages chat interactions, message sending, and flashcard generation
 */
import { renderChatMessage, renderAttachmentCard } from '../components/assistantPageHelpers'
import { createChatMessage, saveChatHistory } from '../storage'
import { buildCourseContext } from '../services/courseDataService'
import { streamChat, formatErrorMessage } from '../services/chatService'
import { convertPdfToImages } from '../services/fileService'
import { PROVIDER_DEFAULTS } from '../config'
import { FLASHCARD_GENERATION_PROMPT } from '../types/flashcard'
import { MINDMAP_GENERATION_PROMPT } from '../types/mindmap'
import { readFileAsBase64, readFileAsText } from '../utils/fileUtils'
import {
  showStatus,
  scrollToBottom,
  renderMessages,
  setActiveToolTab,
  setActiveMindmapMessageId,
  openAssistantPrompt,
  openAssistantConfirm
} from '../utils/uiUtils'
import { filterContextBySelectedMaterials, getCurrentSettings, getCurrentCourseId, getCurrentCourseName, getSelectedCourseMaterials, getMaterialSelectionKey } from './courseHandler'
import type { ChatMessage, Attachment, ProviderConfig, FlashcardData, MindmapData, CourseContext, Provider, MaterialFile } from '../types'

type ChatMode = 'chat' | 'flashcard' | 'mindmap'
type MaterialLoadStatus = 'pending' | 'ready' | 'failed'

interface MaterialLoadState {
  status: MaterialLoadStatus
  fileName: string
  updatedAt: number
  error?: string
  promise?: Promise<void>
}

interface LoadingIndicatorHandle {
  root: HTMLElement
  statusEl: HTMLElement
  toggleBtn: HTMLButtonElement
  stopBtn: HTMLButtonElement
  previewWrap: HTMLElement
  previewEl: HTMLElement
  startedAt: number
  waitingStartedAt: number
  receivingStartedAt: number | null
  timerId: number | null
  expanded: boolean
  phase: 'waiting' | 'receiving' | 'stopped'
  bufferedText: string
  frozenWaitingElapsedMs?: number
  frozenReceivingElapsedMs?: number
}

interface ActiveRunState {
  runId: number
  mode: ChatMode
  assistantMsgId: string
  controller: AbortController
  stopped: boolean
  stoppedByUser: boolean
  loading: LoadingIndicatorHandle
}

const MATERIAL_PRELOAD_WAIT_TIMEOUT_MS = 8000
const TOOL_PRIMARY_TIMEOUT_MS = 90000
const TOOL_RETRY_TIMEOUT_MS = 45000
const TOOL_PRIMARY_HISTORY_WINDOW = 10
const TOOL_RETRY_HISTORY_WINDOW = 4
const TOOL_PARSE_RAW_MAX_CHARS = 3000
const LOADING_TIMER_INTERVAL_MS = 1000
const LOADING_STATUS_WAITING = '正在等待回复'
const LOADING_STATUS_RECEIVING = '正在接收回复'
const LOADING_STATUS_STOPPED = '已手动停止'

// State
let overlayElement: HTMLElement | null = null
let isGenerating = false
let currentMode: ChatMode = 'chat'
let isFlashcardSplitView = false
let isSplitTransitioning = false
let messages: ChatMessage[] = []
let pendingAttachments: File[] = []
const materialLoadStates = new Map<string, MaterialLoadState>()
let activeRun: ActiveRunState | null = null
let runCounter = 0

// External handlers for cleanup
let externalSplitToggleHandler: ((event: Event) => void) | null = null
let externalClearHistoryHandler: ((event: Event) => void) | null = null
let externalMaterialToggleHandler: ((event: Event) => void) | null = null
let externalMindmapSelectHandler: ((event: Event) => void) | null = null
let externalMindmapRenameHandler: ((event: Event) => void) | null = null
let externalMindmapDeleteHandler: ((event: Event) => void) | null = null
let externalCourseChangedHandler: ((event: Event) => void) | null = null

// Setter functions
export function setOverlayElement(element: HTMLElement | null): void {
  overlayElement = element
}

export function getOverlayElement(): HTMLElement | null {
  return overlayElement
}

export function getMessages(): ChatMessage[] {
  return messages
}

export function setMessages(newMessages: ChatMessage[]): void {
  messages = newMessages
  renderMessages(messages, overlayElement)
}

export function getIsGenerating(): boolean {
  return isGenerating
}

export function getIsFlashcardMode(): boolean {
  return currentMode === 'flashcard'
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

export function cleanupChatHandlers(): void {
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
  if (externalMindmapSelectHandler) {
    window.removeEventListener('xzzd:assistant-mindmap-select', externalMindmapSelectHandler)
    externalMindmapSelectHandler = null
  }
  if (externalMindmapRenameHandler) {
    window.removeEventListener('xzzd:assistant-mindmap-rename', externalMindmapRenameHandler)
    externalMindmapRenameHandler = null
  }
  if (externalMindmapDeleteHandler) {
    window.removeEventListener('xzzd:assistant-mindmap-delete', externalMindmapDeleteHandler)
    externalMindmapDeleteHandler = null
  }
  if (externalCourseChangedHandler) {
    window.removeEventListener('xzzd:assistant-course-changed', externalCourseChangedHandler)
    externalCourseChangedHandler = null
  }
  if (activeRun) {
    stopRun(activeRun, false)
    clearActiveRun(activeRun)
  }
}

export function adjustTextareaHeight(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  el.style.height = (el.scrollHeight) + 'px'
}

function buildFlashcardPrompt(content: string): string {
  const selectedCount = getSelectedCourseMaterials().size
  const userText = content || (selectedCount > 0
    ? `请基于我在侧边栏勾选的 ${selectedCount} 份课程资料生成闪卡。`
    : '请基于提供的材料生成闪卡。')
  return `${FLASHCARD_GENERATION_PROMPT}\n\n用户需求：${userText}`
}

function buildMindmapPrompt(content: string): string {
  const selectedCount = getSelectedCourseMaterials().size
  const userText = content || (selectedCount > 0
    ? `请基于我在侧边栏勾选的 ${selectedCount} 份课程资料生成思维导图。`
    : '请基于提供的材料生成思维导图。')
  return `${MINDMAP_GENERATION_PROMPT}\n\n用户需求：${userText}`
}

function sanitizeModelOutput(raw: string): string {
  let cleaned = raw.trim()

  cleaned = cleaned.replace(/<\|(?:begin_of_box|end_of_box|file_separator|thought)\|>/g, "").trim()

  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.substring(11)
  } else if (cleaned.startsWith('```md')) {
    cleaned = cleaned.substring(5)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3)
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3)
  }

  return cleaned.trim()
}

function parseFlashcardResponse(raw: string): FlashcardData | null {
  const sanitizeInvalidJsonBackslashes = (input: string): string => {
    let output = ''
    let inString = false
    let escaped = false

    for (let i = 0; i < input.length; i++) {
      const ch = input[i]

      if (!inString) {
        if (ch === '"') inString = true
        output += ch
        continue
      }

      if (escaped) {
        output += ch
        escaped = false
        continue
      }

      if (ch === '\\') {
        const next = input[i + 1]
        const validEscape = next === '"' || next === '\\' || next === '/' || next === 'b' || next === 'f' || next === 'n' || next === 'r' || next === 't' || next === 'u'
        if (validEscape) {
          output += ch
          escaped = true
        } else {
          output += '\\\\'
        }
        continue
      }

      if (ch === '"') {
        inString = false
      }

      output += ch
    }

    return output
  }

  console.log('XZZDPRO: Raw flashcard response:', raw.substring(0, 200))

  let cleaned = sanitizeModelOutput(raw)

  if (cleaned.startsWith('json')) {
    cleaned = cleaned.substring(4).trim()
  } else if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7)
  }

  cleaned = cleaned.trim()
  console.log('XZZDPRO: Cleaned flashcard response:', cleaned.substring(0, 200))

  try {
    const parsed = JSON.parse(cleaned) as FlashcardData
    console.log('XZZDPRO: Parsed flashcard data:', { topic: parsed.topic, cardCount: parsed.cards?.length })

    if (!parsed || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
      console.error('XZZDPRO: Invalid flashcard data structure')
      return null
    }
    return parsed
  } catch (err) {
    const sanitized = sanitizeInvalidJsonBackslashes(cleaned)
    try {
      const parsed = JSON.parse(sanitized) as FlashcardData
      console.log('XZZDPRO: Parsed flashcard data after backslash sanitization:', { topic: parsed.topic, cardCount: parsed.cards?.length })

      if (!parsed || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
        console.error('XZZDPRO: Invalid flashcard data structure after sanitization')
        return null
      }
      return parsed
    } catch (sanitizeErr) {
      console.error('XZZDPRO: Failed to parse flashcard JSON:', sanitizeErr, '\nContent:', cleaned.substring(0, 500))
      return null
    }
  }
}

function parseMindmapResponse(raw: string): MindmapData | null {
  const cleaned = sanitizeModelOutput(raw)
    .replace(/<[^>]*>/g, '')
    .trim()

  if (!cleaned) {
    return null
  }

  const hasHeading = /^#{1,6}\s+\S/m.test(cleaned)
  const hasList = /^\s*[-*+]\s+\S/m.test(cleaned) || /^\s*\d+\.\s+\S/m.test(cleaned)
  if (!hasHeading && !hasList) {
    return null
  }

  const titleFromHeading = cleaned.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim()
  const title = (titleFromHeading || '学习导图').replace(/[#*_`\[\]]/g, '').trim() || '学习导图'
  const markdown = hasHeading ? cleaned : `# ${title}\n\n${cleaned}`

  return {
    title,
    markdown,
    version: 'v1'
  }
}

function updateMindmapMarkdownTitle(markdown: string, newTitle: string): string {
  const cleaned = (markdown || '').trim()
  if (!cleaned) {
    return `# ${newTitle}`
  }

  if (/^#{1,6}\s+.+$/m.test(cleaned)) {
    return cleaned.replace(/^#{1,6}\s+.+$/m, `# ${newTitle}`)
  }

  return `# ${newTitle}\n\n${cleaned}`
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function getWaitingElapsedMs(handle: LoadingIndicatorHandle): number {
  return handle.frozenWaitingElapsedMs ?? (Date.now() - handle.waitingStartedAt)
}

function getReceivingElapsedMs(handle: LoadingIndicatorHandle): number {
  if (!handle.receivingStartedAt) {
    return handle.frozenReceivingElapsedMs ?? 0
  }
  return handle.frozenReceivingElapsedMs ?? (Date.now() - handle.receivingStartedAt)
}

function updateLoadingStatusText(handle: LoadingIndicatorHandle): void {
  const waitingText = formatElapsed(getWaitingElapsedMs(handle))
  const receivingText = formatElapsed(getReceivingElapsedMs(handle))
  if (handle.phase === 'waiting') {
    handle.statusEl.textContent = `${LOADING_STATUS_WAITING}（等待 ${waitingText}）`
    return
  }
  if (handle.phase === 'receiving') {
    handle.statusEl.textContent = `${LOADING_STATUS_RECEIVING}（接收 ${receivingText}，等待 ${waitingText}）`
    return
  }
  handle.statusEl.textContent = `${LOADING_STATUS_STOPPED}（接收 ${receivingText}，等待 ${waitingText}）`
}

function setLoadingExpanded(handle: LoadingIndicatorHandle, expanded: boolean): void {
  handle.expanded = expanded
  handle.previewWrap.style.display = expanded ? 'block' : 'none'
  handle.toggleBtn.textContent = expanded ? '收起预览' : '展开预览'
}

function appendLoadingPreviewChunk(handle: LoadingIndicatorHandle, chunk: string): void {
  if (!chunk) return
  handle.bufferedText += chunk
  handle.previewEl.textContent = handle.bufferedText
  if (handle.expanded) {
    handle.previewEl.scrollTop = handle.previewEl.scrollHeight
  }
}

function setLoadingPhase(handle: LoadingIndicatorHandle, phase: LoadingIndicatorHandle['phase']): void {
  const previousPhase = handle.phase
  if (phase === 'receiving' && !handle.receivingStartedAt) {
    if (handle.frozenWaitingElapsedMs === undefined) {
      handle.frozenWaitingElapsedMs = Date.now() - handle.waitingStartedAt
    }
    handle.receivingStartedAt = Date.now()
  }
  handle.phase = phase
  if (phase === 'waiting') {
    handle.toggleBtn.disabled = true
    handle.toggleBtn.title = '收到内容后可展开预览'
    setLoadingExpanded(handle, false)
  } else if (phase === 'receiving') {
    handle.toggleBtn.disabled = false
    handle.toggleBtn.title = ''
  } else {
    handle.toggleBtn.disabled = false
  }
  updateLoadingStatusText(handle)
  if (previousPhase !== phase) {
    console.debug('XZZDPRO: stream phase transition', { from: previousPhase, to: phase })
  }
}

function freezeLoadingTimer(handle: LoadingIndicatorHandle): void {
  if (handle.frozenWaitingElapsedMs === undefined) {
    handle.frozenWaitingElapsedMs = Date.now() - handle.waitingStartedAt
  }
  if (handle.frozenReceivingElapsedMs === undefined) {
    handle.frozenReceivingElapsedMs = handle.receivingStartedAt ? Date.now() - handle.receivingStartedAt : 0
  }
  if (handle.timerId !== null) {
    window.clearInterval(handle.timerId)
    handle.timerId = null
  }
}

function finalizeLoadingIndicator(handle: LoadingIndicatorHandle, remove = true): void {
  freezeLoadingTimer(handle)
  if (remove) {
    handle.root.remove()
  }
}

function createActiveRun(mode: ChatMode, assistantMsgId: string, loading: LoadingIndicatorHandle): ActiveRunState {
  if (activeRun) {
    stopRun(activeRun, false)
    clearActiveRun(activeRun)
  }
  runCounter += 1
  const run: ActiveRunState = {
    runId: runCounter,
    mode,
    assistantMsgId,
    controller: new AbortController(),
    stopped: false,
    stoppedByUser: false,
    loading
  }
  activeRun = run
  return run
}

function isRunCurrent(run: ActiveRunState): boolean {
  return !!activeRun && activeRun.runId === run.runId
}

function stopRun(run: ActiveRunState, stoppedByUser = true): void {
  if (!isRunCurrent(run) || run.stopped) return
  run.stopped = true
  run.stoppedByUser = stoppedByUser
  run.controller.abort()
  run.loading.stopBtn.disabled = true
  setLoadingPhase(run.loading, 'stopped')
  freezeLoadingTimer(run.loading)
}

function clearActiveRun(run: ActiveRunState): void {
  if (isRunCurrent(run)) {
    activeRun = null
  }
}

function trimRawModelOutput(raw: string): string {
  const content = sanitizeModelOutput(raw || '').trim()
  if (!content) return ''
  if (content.length <= TOOL_PARSE_RAW_MAX_CHARS) {
    return content
  }
  return `${content.slice(0, TOOL_PARSE_RAW_MAX_CHARS)}\n\n...(模型输出过长，已截断)`
}

function buildToolParseFailureMessage(toolLabel: string, raw: string): string {
  const preview = trimRawModelOutput(raw)
  if (!preview) {
    return `未能解析${toolLabel}结构，模型返回为空。`
  }
  return `未能解析${toolLabel}结构，以下为模型原始输出：\n\n${preview}`
}

function buildToolMessagesWithWindow(
  baseMessages: ChatMessage[],
  promptContent: string,
  historyWindow: number
): ChatMessage[] {
  const history = historyWindow > 0 ? baseMessages.slice(-historyWindow) : []
  return history.map((msg, idx, arr) => {
    if (idx === arr.length - 1 && msg.role === 'user') {
      return { ...msg, content: promptContent }
    }
    return msg
  })
}

function buildToolRetryContext(context: CourseContext): CourseContext {
  const trimmedMaterials = context.materials
    .slice(0, 3)
    .map((material) => ({
      ...material,
      files: (material.files || []).slice(0, 2)
    }))
  return {
    ...context,
    materials: trimmedMaterials
  }
}

async function streamToolResponseWithTimeout(options: {
  messages: ChatMessage[]
  context: CourseContext
  provider: Provider
  config: ProviderConfig
  timeoutMs: number
  signal?: AbortSignal
  onProgress: (msg: string) => void
  onChunk?: (chunk: string) => void
  onFirstChunk?: () => void
}): Promise<string> {
  const { messages, context, provider, config, timeoutMs, signal, onProgress, onChunk, onFirstChunk } = options
  let fullResponse = ''
  let settled = false
  let hasFirstChunk = false

  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('STREAM_ABORTED'))
      return
    }

    let timer = 0
    const clearTimer = () => {
      if (timer) {
        window.clearTimeout(timer)
      }
    }

    const abortListener = () => {
      if (settled) return
      settled = true
      clearTimer()
      signal?.removeEventListener('abort', abortListener)
      reject(new Error('STREAM_ABORTED'))
    }

    timer = window.setTimeout(() => {
      if (settled) return
      if (hasFirstChunk) return
      settled = true
      signal?.removeEventListener('abort', abortListener)
      reject(new Error(`TOOL_TIMEOUT:${timeoutMs}`))
    }, timeoutMs)

    signal?.addEventListener('abort', abortListener, { once: true })

    void streamChat({
      messages,
      context,
      provider,
      config,
      signal,
      onProgress: (msg) => {
        if (settled) return
        onProgress(msg)
      },
      onFirstChunk: () => {
        if (settled) return
        if (!hasFirstChunk) {
          hasFirstChunk = true
          clearTimer()
          onFirstChunk?.()
        }
      },
      onChunk: (chunk) => {
        if (settled) return
        fullResponse += chunk
        onChunk?.(chunk)
      }
    }).then(() => {
      if (settled) return
      settled = true
      clearTimer()
      signal?.removeEventListener('abort', abortListener)
      resolve()
    }).catch((error) => {
      if (settled) return
      settled = true
      clearTimer()
      signal?.removeEventListener('abort', abortListener)
      reject(error)
    })
  })

  return fullResponse
}

function isToolTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('TOOL_TIMEOUT:')
}

function isStreamAbortError(error: unknown): boolean {
  return error instanceof Error && error.message === 'STREAM_ABORTED'
}

function setMaterialLoadState(selectionKey: string, next: MaterialLoadState): void {
  materialLoadStates.set(selectionKey, {
    ...next,
    updatedAt: Date.now()
  })
}

function startSelectedMaterialPreload(selectionKey: string, file: MaterialFile, materialTitle: string): void {
  const preloadPromise = (async () => {
    try {
      const { preloadSelectedMaterial } = await import('./courseHandler')
      await preloadSelectedMaterial(file, materialTitle)
      const current = materialLoadStates.get(selectionKey)
      if (!current || current.promise !== preloadPromise) return
      setMaterialLoadState(selectionKey, {
        status: 'ready',
        fileName: file.name
      })
    } catch (error) {
      const current = materialLoadStates.get(selectionKey)
      if (!current || current.promise !== preloadPromise) return
      const errorMsg = error instanceof Error ? error.message : String(error)
      setMaterialLoadState(selectionKey, {
        status: 'failed',
        fileName: file.name,
        error: errorMsg
      })
      showStatus(`读取失败: ${file.name}`, 'error')
      console.error('Failed to preload selected material:', error)
    }
  })()

  setMaterialLoadState(selectionKey, {
    status: 'pending',
    fileName: file.name,
    promise: preloadPromise
  })
}

async function waitForSelectedMaterialsReady(): Promise<void> {
  const selected = getSelectedCourseMaterials()
  if (selected.size === 0) return

  const pendingEntries = Array.from(selected.keys())
    .map((key) => [key, materialLoadStates.get(key)] as const)
    .filter(([, state]) => state?.status === 'pending' && !!state.promise)

  if (pendingEntries.length === 0) {
    return
  }

  showStatus(`正在等待 ${pendingEntries.length} 份资料完成解析...`, 'info')
  await Promise.race([
    Promise.allSettled(pendingEntries.map(([, state]) => state!.promise as Promise<void>)).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, MATERIAL_PRELOAD_WAIT_TIMEOUT_MS))
  ])

  const selectedStates = Array.from(selected.keys())
    .map((key) => materialLoadStates.get(key))
    .filter((state): state is MaterialLoadState => !!state)

  const stillPending = selectedStates.filter((state) => state.status === 'pending').map((state) => state.fileName)
  if (stillPending.length > 0) {
    showStatus(`部分资料仍在解析，先继续生成：${stillPending.slice(0, 2).join('、')}${stillPending.length > 2 ? ' 等' : ''}`, 'info')
  }

  const failed = selectedStates
    .filter((state) => state.status === 'failed')
    .map((state) => state.fileName)
  if (failed.length > 0) {
    showStatus(`以下资料解析失败：${failed.slice(0, 2).join('、')}${failed.length > 2 ? ' 等' : ''}`, 'error')
  }
}

export function setupChatHandlers(): void {
  console.log('XZZDPRO: setupChatHandlers called')
  const input = overlayElement?.querySelector('#chat-input') as HTMLTextAreaElement
  const sendBtn = overlayElement?.querySelector('#send-btn') as HTMLButtonElement
  const flashcardSendBtn = overlayElement?.querySelector('#flashcard-send-btn') as HTMLButtonElement
  const mindmapSendBtn = overlayElement?.querySelector('#mindmap-send-btn') as HTMLButtonElement
  const flashcardModeBtn = overlayElement?.querySelector('#flashcard-mode-btn') as HTMLButtonElement
  const mindmapModeBtn = overlayElement?.querySelector('#mindmap-mode-btn') as HTMLButtonElement
  const chatAreaEl = overlayElement?.querySelector('.chat-area') as HTMLElement
  const attachBtn = overlayElement?.querySelector('#attach-btn') as HTMLButtonElement
  const fileInput = overlayElement?.querySelector('#file-input') as HTMLInputElement
  const sidebarSplitToggleBtn = document.getElementById('nav-assistant-flashcard-toggle') as HTMLButtonElement | null


  const updateSplitUI = () => {
    if (!chatAreaEl) return

    if (isFlashcardSplitView) {
      chatAreaEl.classList.add('split-open')
      chatAreaEl.classList.remove('split-collapsing')
      sidebarSplitToggleBtn?.classList.add('active')
      if (sidebarSplitToggleBtn) sidebarSplitToggleBtn.title = '收起闪卡面板'
    } else {
      chatAreaEl.classList.remove('split-open')
      chatAreaEl.classList.remove('split-collapsing')
      sidebarSplitToggleBtn?.classList.remove('active')
      if (sidebarSplitToggleBtn) sidebarSplitToggleBtn.title = '展开闪卡面板'
    }
  }

  const toggleSplitView = () => {
    if (!chatAreaEl || isSplitTransitioning) return

    if (isFlashcardSplitView) {
      isSplitTransitioning = true
      if (sidebarSplitToggleBtn) sidebarSplitToggleBtn.disabled = true
      sidebarSplitToggleBtn?.classList.remove('active')
      if (sidebarSplitToggleBtn) sidebarSplitToggleBtn.title = '展开闪卡面板'

      chatAreaEl.classList.add('split-collapsing')

      window.setTimeout(() => {
        isFlashcardSplitView = false
        chatAreaEl.classList.remove('split-open')
        chatAreaEl.classList.remove('split-collapsing')
        isSplitTransitioning = false
        if (sidebarSplitToggleBtn) sidebarSplitToggleBtn.disabled = false
        renderMessages(messages, overlayElement)
      }, 300)
      return
    }

    isFlashcardSplitView = true
    updateSplitUI()
    renderMessages(messages, overlayElement)
  }

  const clearCurrentHistory = async () => {
    const activeCourseId = getCurrentCourseId()
    const activeCourseName = getCurrentCourseName()
    if (!activeCourseId) return
    if (confirm('确认要清空当前课程的聊天记录吗？')) {
      messages = []
      renderMessages(messages, overlayElement)
      await saveChatHistory(activeCourseId, {
        courseId: activeCourseId,
        courseName: activeCourseName,
        messages: [],
        updatedAt: Date.now()
      })
    }
  }

  const updateModeUI = () => {
    if (!input) return
    const chatPlaceholder = '问问学习助理'
    const flashcardPlaceholder = '生成闪卡：输入要点或上传课件'
    const mindmapPlaceholder = '生成思维导图：输入主题或上传课件'
    const activeCourseId = getCurrentCourseId()

    if (currentMode === 'flashcard') {
      flashcardModeBtn?.classList.add('active')
      mindmapModeBtn?.classList.remove('active')
      flashcardModeBtn?.setAttribute('title', '当前为闪卡模式，点击切换到聊天模式')
      mindmapModeBtn?.setAttribute('title', '切换到导图模式')
      setActiveToolTab('flashcard', overlayElement)
      if (flashcardSendBtn) {
        flashcardSendBtn.style.display = ''
        flashcardSendBtn.disabled = !activeCourseId || isGenerating
      }
      if (mindmapSendBtn) mindmapSendBtn.style.display = 'none'
      if (sendBtn) sendBtn.style.display = 'none'
      input.placeholder = flashcardPlaceholder
      return
    }

    if (currentMode === 'mindmap') {
      flashcardModeBtn?.classList.remove('active')
      mindmapModeBtn?.classList.add('active')
      flashcardModeBtn?.setAttribute('title', '切换到闪卡模式')
      mindmapModeBtn?.setAttribute('title', '当前为导图模式，点击切换到聊天模式')
      setActiveToolTab('mindmap', overlayElement)
      if (flashcardSendBtn) flashcardSendBtn.style.display = 'none'
      if (mindmapSendBtn) {
        mindmapSendBtn.style.display = ''
        mindmapSendBtn.disabled = !activeCourseId || isGenerating
      }
      if (sendBtn) sendBtn.style.display = 'none'
      input.placeholder = mindmapPlaceholder
    } else {
      flashcardModeBtn?.classList.remove('active')
      mindmapModeBtn?.classList.remove('active')
      flashcardModeBtn?.setAttribute('title', '当前为聊天模式，点击切换到闪卡模式')
      mindmapModeBtn?.setAttribute('title', '当前为聊天模式，点击切换到导图模式')
      if (flashcardSendBtn) flashcardSendBtn.style.display = 'none'
      if (mindmapSendBtn) mindmapSendBtn.style.display = 'none'
      if (sendBtn) {
        sendBtn.style.display = ''
        sendBtn.disabled = !activeCourseId || isGenerating
      }
      input.placeholder = chatPlaceholder
    }
  }

  if (externalSplitToggleHandler) {
    window.removeEventListener('xzzd:assistant-toggle-flashcard', externalSplitToggleHandler)
  }
  externalSplitToggleHandler = () => {
    toggleSplitView()
  }
  window.addEventListener('xzzd:assistant-toggle-flashcard', externalSplitToggleHandler)

  if (externalClearHistoryHandler) {
    window.removeEventListener('xzzd:assistant-clear-history', externalClearHistoryHandler)
  }
  externalClearHistoryHandler = () => {
    void clearCurrentHistory()
  }
  window.addEventListener('xzzd:assistant-clear-history', externalClearHistoryHandler)

  if (externalCourseChangedHandler) {
    window.removeEventListener('xzzd:assistant-course-changed', externalCourseChangedHandler)
  }
  externalCourseChangedHandler = () => {
    if (activeRun) {
      stopRun(activeRun, false)
      clearActiveRun(activeRun)
    }
    materialLoadStates.clear()
  }
  window.addEventListener('xzzd:assistant-course-changed', externalCourseChangedHandler)

  const persistCurrentMessages = async () => {
    const activeCourseId = getCurrentCourseId()
    if (!activeCourseId) return
    await saveChatHistory(activeCourseId, {
      courseId: activeCourseId,
      courseName: getCurrentCourseName(),
      messages,
      updatedAt: Date.now()
    })
  }

  if (externalMindmapSelectHandler) {
    window.removeEventListener('xzzd:assistant-mindmap-select', externalMindmapSelectHandler)
  }
  externalMindmapSelectHandler = (event: Event) => {
    const customEvent = event as CustomEvent<{ messageId?: string }>
    const messageId = customEvent.detail?.messageId || ''
    if (!messageId) return
    const exists = messages.some(msg => msg.id === messageId && !!msg.mindmap)
    if (!exists) return
    setActiveMindmapMessageId(messageId)
    renderMessages(messages, overlayElement)
  }
  window.addEventListener('xzzd:assistant-mindmap-select', externalMindmapSelectHandler)

  if (externalMindmapRenameHandler) {
    window.removeEventListener('xzzd:assistant-mindmap-rename', externalMindmapRenameHandler)
  }
  externalMindmapRenameHandler = (event: Event) => {
    void (async () => {
      const customEvent = event as CustomEvent<{ messageId?: string }>
      const messageId = customEvent.detail?.messageId || ''
      if (!messageId) return
      const messageIndex = messages.findIndex(msg => msg.id === messageId && !!msg.mindmap)
      if (messageIndex === -1) return

      const targetMessage = messages[messageIndex]
      const currentTitle = (targetMessage.mindmap?.title || '学习导图').trim() || '学习导图'
      const inputTitle = await openAssistantPrompt({
        title: '修改导图标题',
        value: currentTitle,
        placeholder: '请输入新的导图标题',
        confirmText: '保存',
        maxLength: 60
      }, overlayElement)
      if (inputTitle === null) return

      const nextTitle = inputTitle.trim()
      if (!nextTitle) {
        showStatus('标题不能为空', 'error')
        return
      }

      const normalizedTitle = nextTitle.slice(0, 60)
      if (!targetMessage.mindmap) return
      targetMessage.mindmap = {
        ...targetMessage.mindmap,
        title: normalizedTitle,
        markdown: updateMindmapMarkdownTitle(targetMessage.mindmap.markdown, normalizedTitle)
      }

      setActiveMindmapMessageId(messageId)
      renderMessages(messages, overlayElement)
      void persistCurrentMessages()
      showStatus('导图标题已更新', 'success')
    })()
  }
  window.addEventListener('xzzd:assistant-mindmap-rename', externalMindmapRenameHandler)

  if (externalMindmapDeleteHandler) {
    window.removeEventListener('xzzd:assistant-mindmap-delete', externalMindmapDeleteHandler)
  }
  externalMindmapDeleteHandler = (event: Event) => {
    void (async () => {
      const customEvent = event as CustomEvent<{ messageId?: string }>
      const messageId = customEvent.detail?.messageId || ''
      if (!messageId) return
      const messageIndex = messages.findIndex(msg => msg.id === messageId && !!msg.mindmap)
      if (messageIndex === -1) return

      const confirmed = await openAssistantConfirm({
        title: '删除思维导图',
        message: '删除后将同步从当前课程聊天历史中移除，确认继续吗？',
        confirmText: '删除',
        danger: true
      }, overlayElement)
      if (!confirmed) return

      messages = messages.filter(msg => msg.id !== messageId)
      setActiveMindmapMessageId(null)
      renderMessages(messages, overlayElement)
      void persistCurrentMessages()
      showStatus('导图已删除', 'success')
    })()
  }
  window.addEventListener('xzzd:assistant-mindmap-delete', externalMindmapDeleteHandler)

  const previewArea = overlayElement?.querySelector('#file-preview-area') as HTMLElement
  const plusMenu = overlayElement?.querySelector('#plus-menu') as HTMLElement
  const menuUploadBtn = overlayElement?.querySelector('#menu-upload-btn') as HTMLButtonElement

  console.log('XZZDPRO: Elements found:', {
    input: !!input,
    attachBtn: !!attachBtn,
    plusMenu: !!plusMenu,
    menuUploadBtn: !!menuUploadBtn
  })

  updateModeUI()
  updateSplitUI()

  flashcardModeBtn?.addEventListener('click', () => {
    currentMode = currentMode === 'flashcard' ? 'chat' : 'flashcard'
    updateModeUI()
  })

  mindmapModeBtn?.addEventListener('click', () => {
    currentMode = currentMode === 'mindmap' ? 'chat' : 'mindmap'
    updateModeUI()
  })

  // Attach Button (Toggle Menu)
  if (attachBtn) {
    attachBtn.addEventListener('click', (e) => {
      console.log('XZZDPRO: attachBtn clicked')
      e.stopPropagation()
      e.preventDefault()
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

  if (externalMaterialToggleHandler) {
    window.removeEventListener('xzzd:assistant-material-toggle', externalMaterialToggleHandler)
  }
  externalMaterialToggleHandler = async (event: Event) => {
    const customEvent = event as CustomEvent<{
      courseId?: string
      checked?: boolean
      file?: { id: number | string; name: string; size: number; downloadUrl: string; materialTitle?: string }
    }>
    const courseId = customEvent.detail?.courseId
    const checked = !!customEvent.detail?.checked
    const file = customEvent.detail?.file

    const activeCourseId = getCurrentCourseId()
    if (!courseId || !activeCourseId || courseId !== activeCourseId || !file?.downloadUrl) return

    const selectedCourseMaterials = getSelectedCourseMaterials()
    const materialTitle = file.materialTitle || '课程资料'
    const selectionKey = getMaterialSelectionKey(file.downloadUrl)
    if (!selectionKey) return

    if (checked) {
      const normalizedFileId = Number(file.id)
      if (!Number.isFinite(normalizedFileId)) {
        showStatus(`资料 ID 无效: ${file.name}`, 'error')
        return
      }
      const normalizedFile = {
        id: normalizedFileId,
        name: file.name,
        size: file.size,
        downloadUrl: file.downloadUrl
      }
      selectedCourseMaterials.set(selectionKey, {
        file: normalizedFile,
        materialTitle
      })
      startSelectedMaterialPreload(selectionKey, normalizedFile, materialTitle)
      return
    }

    selectedCourseMaterials.delete(selectionKey)
    materialLoadStates.delete(selectionKey)
  }
  window.addEventListener('xzzd:assistant-material-toggle', externalMaterialToggleHandler)

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

      const dataAttr = isImage ? `data-filename="${file.name}"` : ''

      return `
        <div class="preview-wrapper" ${dataAttr}>
            ${innerContent}
            <button class="remove-attachment-btn" data-index="${index}">×</button>
        </div>`
    }).join('')

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
  if (overlayElement) {
    overlayElement.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement
      const composedPath = e.composedPath ? e.composedPath() : []

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
        e.stopImmediatePropagation()
      }

      // Copy Button Logic
      if (copyBtn) {
        console.log('[Assistant Debug] Executing Copy...')
        const messageEl = copyBtn.closest('.message')
        const msgId = messageEl?.getAttribute('id')

        if (msgId) {
          try {
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
                const dataToRestore = att.originalData ||
                  (Array.isArray(att.content) ? att.content[0] : att.content)

                if (typeof dataToRestore === 'string' && dataToRestore.startsWith('data:')) {
                  const res = await fetch(dataToRestore)
                  const blob = await res.blob()

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
          renderMessages(messages, overlayElement)
          const activeCourseId = getCurrentCourseId()
          const activeCourseName = getCurrentCourseName()
          if (activeCourseId) {
            await saveChatHistory(activeCourseId, {
              courseId: activeCourseId,
              courseName: activeCourseName,
              messages,
              updatedAt: Date.now()
            })
          }
        }
      }
    }, { capture: true })
  } else {
    console.error('[Assistant Debug] overlayElement not found!')
  }

  const setInteractionDisabled = (disabled: boolean) => {
    isGenerating = disabled
    const activeCourseId = getCurrentCourseId()
    if (input) input.disabled = disabled
    if (sendBtn) sendBtn.disabled = disabled || !activeCourseId
    if (flashcardSendBtn) flashcardSendBtn.disabled = disabled || !activeCourseId
    if (mindmapSendBtn) mindmapSendBtn.disabled = disabled || !activeCourseId
    if (attachBtn) attachBtn.disabled = disabled
    updateModeUI()
  }

  const resetInput = () => {
    if (input) {
      input.value = ''
      adjustTextareaHeight(input)
    }
  }

  const processAttachments = async (): Promise<Attachment[]> => {
    if (pendingAttachments.length === 0) return []

    const processedAttachments: Attachment[] = []

    for (const file of pendingAttachments) {
      if (file.type.startsWith('image/')) {
        const base64 = await readFileAsBase64(file)
        processedAttachments.push({
          type: 'image',
          name: file.name,
          content: base64
        })
      } else if (file.type === 'application/pdf') {
        const originalBase64 = await readFileAsBase64(file)
        const blob = new Blob([file], { type: 'application/pdf' })
        const images = await convertPdfToImages(blob)
        processedAttachments.push({
          type: 'pdf',
          name: file.name,
          content: images,
          originalData: originalBase64
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

    pendingAttachments = []
    renderPreviews()
    return processedAttachments
  }

  const appendAssistantLoading = (assistantMsg: ChatMessage): LoadingIndicatorHandle | null => {
    const container = overlayElement?.querySelector('#messages-container')
    if (!container) return null

    const loadingDiv = document.createElement('div')
    loadingDiv.id = `loading-${assistantMsg.id}`
    loadingDiv.className = 'message assistant'
    loadingDiv.innerHTML = `
      <div class="message-body">
        <div class="stream-loading message-text">
          <div class="stream-loading-header">
            <div class="stream-loading-status" data-role="status"></div>
            <div class="stream-loading-actions">
              <button type="button" class="stream-loading-btn" data-action="toggle-preview">展开预览</button>
              <button type="button" class="stream-loading-btn danger" data-action="stop-stream">停止输出</button>
            </div>
          </div>
          <div class="stream-loading-preview-wrap" data-role="preview-wrap" style="display:none;">
            <pre class="stream-loading-preview" data-role="preview"></pre>
          </div>
        </div>
      </div>
    `
    container.appendChild(loadingDiv)

    const statusEl = loadingDiv.querySelector<HTMLElement>('[data-role="status"]')
    const previewWrap = loadingDiv.querySelector<HTMLElement>('[data-role="preview-wrap"]')
    const previewEl = loadingDiv.querySelector<HTMLElement>('[data-role="preview"]')
    const toggleBtn = loadingDiv.querySelector<HTMLButtonElement>('[data-action="toggle-preview"]')
    const stopBtn = loadingDiv.querySelector<HTMLButtonElement>('[data-action="stop-stream"]')

    if (!statusEl || !previewWrap || !previewEl || !toggleBtn || !stopBtn) {
      loadingDiv.remove()
      return null
    }

    const handle: LoadingIndicatorHandle = {
      root: loadingDiv,
      statusEl,
      toggleBtn,
      stopBtn,
      previewWrap,
      previewEl,
      startedAt: Date.now(),
      waitingStartedAt: Date.now(),
      receivingStartedAt: null,
      timerId: null,
      expanded: false,
      phase: 'waiting',
      bufferedText: ''
    }

    toggleBtn.addEventListener('click', () => {
      setLoadingExpanded(handle, !handle.expanded)
    })

    stopBtn.addEventListener('click', () => {
      const run = activeRun
      if (!run || run.assistantMsgId !== assistantMsg.id) return
      stopRun(run, true)
      showStatus('已停止输出，已保留当前内容', 'info')
    })

    setLoadingPhase(handle, 'waiting')
    handle.timerId = window.setInterval(() => {
      updateLoadingStatusText(handle)
    }, LOADING_TIMER_INTERVAL_MS)

    scrollToBottom()
    return handle
  }

  const sendChatMessage = async () => {
    const content = input?.value.trim() || ''

    if (!content && pendingAttachments.length === 0) return

    // 实时获取状态
    const activeCourseId = getCurrentCourseId()
    const activeSettings = getCurrentSettings()
    const activeCourseName = getCurrentCourseName()

    if (!activeCourseId || isGenerating) return

    resetInput()
    setInteractionDisabled(true)

    let processedAttachments: Attachment[] = []
    try {
      processedAttachments = await processAttachments()
    } catch (e) {
      console.error('Attachment processing failed:', e)
      showStatus(`附件处理失败: ${String(e)}`, 'error')
      setInteractionDisabled(false)
      return
    }

    const userMsg = createChatMessage('user', content)
    if (processedAttachments.length > 0) {
      userMsg.attachments = processedAttachments
    }

    messages.push(userMsg)
    renderMessages(messages, overlayElement)

    const assistantMsg = createChatMessage('assistant', '')
    messages.push(assistantMsg)
    const loadingHandle = appendAssistantLoading(assistantMsg)
    if (!loadingHandle) {
      assistantMsg.content = '❌ 无法创建等待状态，请重试'
      renderMessages(messages, overlayElement)
      setInteractionDisabled(false)
      return
    }
    const run = createActiveRun('chat', assistantMsg.id, loadingHandle)

    try {
      await waitForSelectedMaterialsReady()
      let context = await buildCourseContext(activeCourseId, { includeHomeworks: false })
      context = filterContextBySelectedMaterials(context)

      const provider = activeSettings!.provider
      const config = activeSettings!.configs[provider] as ProviderConfig

      let responseText = ''
      let hasFirstChunk = false

      await streamChat({
        messages: messages.slice(0, -1),
        context,
        provider,
        config: {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl || PROVIDER_DEFAULTS[provider].baseUrl,
          model: config.model
        },
        signal: run.controller.signal,
        onProgress: (msg) => {
          if (!isRunCurrent(run) || run.stopped) return
          showStatus(msg, 'info')
        },
        onChunk: (chunk) => {
          if (!isRunCurrent(run) || run.stopped) return
          if (!hasFirstChunk) {
            hasFirstChunk = true
            setLoadingPhase(loadingHandle, 'receiving')
          }
          responseText += chunk
          appendLoadingPreviewChunk(loadingHandle, chunk)
          scrollToBottom()
        }
      })

      if (run.stoppedByUser) {
        assistantMsg.content = responseText.trim()
          ? `${responseText}\n\n[已手动停止]`
          : '[已手动停止]'
      } else {
        assistantMsg.content = responseText
      }
      renderMessages(messages, overlayElement)

      await saveChatHistory(activeCourseId, {
        courseId: activeCourseId,
        courseName: activeCourseName,
        messages,
        updatedAt: Date.now()
      })

    } catch (error) {
      if (isStreamAbortError(error) && run.stoppedByUser) {
        assistantMsg.content = loadingHandle.bufferedText.trim()
          ? `${loadingHandle.bufferedText}\n\n[已手动停止]`
          : '[已手动停止]'
        renderMessages(messages, overlayElement)
        await saveChatHistory(activeCourseId, {
          courseId: activeCourseId,
          courseName: activeCourseName,
          messages,
          updatedAt: Date.now()
        })
      } else {
        console.error('Chat error:', error)
        const errorMsg = error instanceof Error ? formatErrorMessage(error) : '发生未知错误'
        assistantMsg.content = `❌ ${errorMsg}`
        renderMessages(messages, overlayElement)
      }
    } finally {
      finalizeLoadingIndicator(loadingHandle, true)
      clearActiveRun(run)
      setInteractionDisabled(false)
      if (input) input.focus()
    }
  }

  const sendFlashcardMessage = async () => {
    const content = input?.value.trim() || ''
    const selectedMaterialCount = getSelectedCourseMaterials().size

    // 实时获取状态
    const activeCourseId = getCurrentCourseId()
    const activeSettings = getCurrentSettings()
    const activeCourseName = getCurrentCourseName()

    if (!activeCourseId || isGenerating) return
    if (!content && pendingAttachments.length === 0 && selectedMaterialCount === 0) {
      showStatus('请输入内容、上传课件，或在侧边栏勾选资料后再生成闪卡', 'error')
      return
    }

    resetInput()
    setInteractionDisabled(true)

    let processedAttachments: Attachment[] = []
    try {
      processedAttachments = await processAttachments()
    } catch (e) {
      console.error('Attachment processing failed:', e)
      showStatus(`附件处理失败: ${String(e)}`, 'error')
      setInteractionDisabled(false)
      return
    }

    if (processedAttachments.length === 0) {
      if (selectedMaterialCount > 0) {
        showStatus(`将基于已勾选的 ${selectedMaterialCount} 份课程资料生成闪卡`, 'info')
      } else {
        showStatus('未上传资料，将仅基于输入生成闪卡', 'info')
      }
    }

    const userMsg = createChatMessage('user', content || (selectedMaterialCount > 0 ? '基于已勾选资料生成闪卡' : '生成闪卡'))
    if (processedAttachments.length > 0) {
      userMsg.attachments = processedAttachments
    }

    messages.push(userMsg)
    renderMessages(messages, overlayElement)

    const assistantMsg = createChatMessage('assistant', '')
    messages.push(assistantMsg)
    const loadingHandle = appendAssistantLoading(assistantMsg)
    if (!loadingHandle) {
      assistantMsg.content = '❌ 无法创建等待状态，请重试'
      renderMessages(messages, overlayElement)
      setInteractionDisabled(false)
      return
    }
    const run = createActiveRun('flashcard', assistantMsg.id, loadingHandle)

    const promptContent = buildFlashcardPrompt(content)
    const primaryModelMessages = buildToolMessagesWithWindow(messages.slice(0, -1), promptContent, TOOL_PRIMARY_HISTORY_WINDOW)

    try {
      await waitForSelectedMaterialsReady()
      let context = await buildCourseContext(activeCourseId, { includeHomeworks: false })
      context = filterContextBySelectedMaterials(context)

      const provider = activeSettings!.provider
      const config = activeSettings!.configs[provider] as ProviderConfig
      const resolvedConfig = {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl || PROVIDER_DEFAULTS[provider].baseUrl,
        model: config.model
      }

      let fullResponse: string
      try {
        fullResponse = await streamToolResponseWithTimeout({
          messages: primaryModelMessages,
          context,
          provider,
          config: resolvedConfig,
          timeoutMs: TOOL_PRIMARY_TIMEOUT_MS,
          signal: run.controller.signal,
          onProgress: (msg) => {
            if (!isRunCurrent(run) || run.stopped) return
            showStatus(msg, 'info')
          },
          onFirstChunk: () => {
            if (!isRunCurrent(run) || run.stopped) return
            setLoadingPhase(loadingHandle, 'receiving')
          },
          onChunk: (chunk) => {
            if (!isRunCurrent(run) || run.stopped) return
            appendLoadingPreviewChunk(loadingHandle, chunk)
            scrollToBottom()
          }
        })
      } catch (error) {
        if (!isToolTimeoutError(error)) throw error
        showStatus('闪卡生成耗时较长，正在缩小上下文重试...', 'info')
        const retryMessages = buildToolMessagesWithWindow(messages.slice(0, -1), promptContent, TOOL_RETRY_HISTORY_WINDOW)
        const retryContext = buildToolRetryContext(context)
        fullResponse = await streamToolResponseWithTimeout({
          messages: retryMessages,
          context: retryContext,
          provider,
          config: resolvedConfig,
          timeoutMs: TOOL_RETRY_TIMEOUT_MS,
          signal: run.controller.signal,
          onProgress: (msg) => {
            if (!isRunCurrent(run) || run.stopped) return
            showStatus(msg, 'info')
          },
          onFirstChunk: () => {
            if (!isRunCurrent(run) || run.stopped) return
            setLoadingPhase(loadingHandle, 'receiving')
          },
          onChunk: (chunk) => {
            if (!isRunCurrent(run) || run.stopped) return
            appendLoadingPreviewChunk(loadingHandle, chunk)
            scrollToBottom()
          }
        })
      }

      if (run.stoppedByUser) {
        assistantMsg.content = loadingHandle.bufferedText.trim()
          ? `${loadingHandle.bufferedText}\n\n[已手动停止]`
          : '[已手动停止]'
        renderMessages(messages, overlayElement)
        await saveChatHistory(activeCourseId, {
          courseId: activeCourseId,
          courseName: activeCourseName,
          messages,
          updatedAt: Date.now()
        })
        return
      }

      const parsed = parseFlashcardResponse(fullResponse)
      if (!parsed) {
        assistantMsg.content = buildToolParseFailureMessage('闪卡', fullResponse)
        showStatus('未能解析闪卡结构，已展示模型原始输出', 'error')
        renderMessages(messages, overlayElement)
        await saveChatHistory(activeCourseId, {
          courseId: activeCourseId,
          courseName: activeCourseName,
          messages,
          updatedAt: Date.now()
        })
        return
      }

      assistantMsg.flashcards = parsed
      assistantMsg.content = fullResponse
      renderMessages(messages, overlayElement)

      await saveChatHistory(activeCourseId, {
        courseId: activeCourseId,
        courseName: activeCourseName,
        messages,
        updatedAt: Date.now()
      })

    } catch (error) {
      if (isStreamAbortError(error) && run.stoppedByUser) {
        assistantMsg.content = loadingHandle.bufferedText.trim()
          ? `${loadingHandle.bufferedText}\n\n[已手动停止]`
          : '[已手动停止]'
        renderMessages(messages, overlayElement)
        await saveChatHistory(activeCourseId, {
          courseId: activeCourseId,
          courseName: activeCourseName,
          messages,
          updatedAt: Date.now()
        })
      } else {
        console.error('Flashcard generation error:', error)
        const errorMsg = error instanceof Error ? formatErrorMessage(error) : '生成闪卡时发生错误'
        assistantMsg.content = `❌ ${errorMsg}`
        renderMessages(messages, overlayElement)
      }
    } finally {
      finalizeLoadingIndicator(loadingHandle, true)
      clearActiveRun(run)
      setInteractionDisabled(false)
      if (input) input.focus()
    }
  }

  const sendMindmapMessage = async () => {
    const content = input?.value.trim() || ''
    const selectedMaterialCount = getSelectedCourseMaterials().size

    const activeCourseId = getCurrentCourseId()
    const activeSettings = getCurrentSettings()
    const activeCourseName = getCurrentCourseName()

    if (!activeCourseId || isGenerating) return
    if (!content && pendingAttachments.length === 0 && selectedMaterialCount === 0) {
      showStatus('请输入内容、上传课件，或在侧边栏勾选资料后再生成导图', 'error')
      return
    }

    resetInput()
    setInteractionDisabled(true)

    let processedAttachments: Attachment[] = []
    try {
      processedAttachments = await processAttachments()
    } catch (e) {
      console.error('Attachment processing failed:', e)
      showStatus(`附件处理失败: ${String(e)}`, 'error')
      setInteractionDisabled(false)
      return
    }

    if (processedAttachments.length === 0) {
      if (selectedMaterialCount > 0) {
        showStatus(`将基于已勾选的 ${selectedMaterialCount} 份课程资料生成思维导图`, 'info')
      } else {
        showStatus('未上传资料，将仅基于输入生成思维导图', 'info')
      }
    }

    const userMsg = createChatMessage('user', content || (selectedMaterialCount > 0 ? '基于已勾选资料生成思维导图' : '生成思维导图'))
    if (processedAttachments.length > 0) {
      userMsg.attachments = processedAttachments
    }

    messages.push(userMsg)
    renderMessages(messages, overlayElement)

    const assistantMsg = createChatMessage('assistant', '')
    messages.push(assistantMsg)
    const loadingHandle = appendAssistantLoading(assistantMsg)
    if (!loadingHandle) {
      assistantMsg.content = '❌ 无法创建等待状态，请重试'
      renderMessages(messages, overlayElement)
      setInteractionDisabled(false)
      return
    }
    const run = createActiveRun('mindmap', assistantMsg.id, loadingHandle)

    const promptContent = buildMindmapPrompt(content)
    const primaryModelMessages = buildToolMessagesWithWindow(messages.slice(0, -1), promptContent, TOOL_PRIMARY_HISTORY_WINDOW)

    try {
      await waitForSelectedMaterialsReady()
      let context = await buildCourseContext(activeCourseId, { includeHomeworks: false })
      context = filterContextBySelectedMaterials(context)

      const provider = activeSettings!.provider
      const config = activeSettings!.configs[provider] as ProviderConfig
      const resolvedConfig = {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl || PROVIDER_DEFAULTS[provider].baseUrl,
        model: config.model
      }

      let fullResponse: string
      try {
        fullResponse = await streamToolResponseWithTimeout({
          messages: primaryModelMessages,
          context,
          provider,
          config: resolvedConfig,
          timeoutMs: TOOL_PRIMARY_TIMEOUT_MS,
          signal: run.controller.signal,
          onProgress: (msg) => {
            if (!isRunCurrent(run) || run.stopped) return
            showStatus(msg, 'info')
          },
          onFirstChunk: () => {
            if (!isRunCurrent(run) || run.stopped) return
            setLoadingPhase(loadingHandle, 'receiving')
          },
          onChunk: (chunk) => {
            if (!isRunCurrent(run) || run.stopped) return
            appendLoadingPreviewChunk(loadingHandle, chunk)
            scrollToBottom()
          }
        })
      } catch (error) {
        if (!isToolTimeoutError(error)) throw error
        showStatus('导图生成耗时较长，正在缩小上下文重试...', 'info')
        const retryMessages = buildToolMessagesWithWindow(messages.slice(0, -1), promptContent, TOOL_RETRY_HISTORY_WINDOW)
        const retryContext = buildToolRetryContext(context)
        fullResponse = await streamToolResponseWithTimeout({
          messages: retryMessages,
          context: retryContext,
          provider,
          config: resolvedConfig,
          timeoutMs: TOOL_RETRY_TIMEOUT_MS,
          signal: run.controller.signal,
          onProgress: (msg) => {
            if (!isRunCurrent(run) || run.stopped) return
            showStatus(msg, 'info')
          },
          onFirstChunk: () => {
            if (!isRunCurrent(run) || run.stopped) return
            setLoadingPhase(loadingHandle, 'receiving')
          },
          onChunk: (chunk) => {
            if (!isRunCurrent(run) || run.stopped) return
            appendLoadingPreviewChunk(loadingHandle, chunk)
            scrollToBottom()
          }
        })
      }

      if (run.stoppedByUser) {
        assistantMsg.content = loadingHandle.bufferedText.trim()
          ? `${loadingHandle.bufferedText}\n\n[已手动停止]`
          : '[已手动停止]'
        renderMessages(messages, overlayElement)
        await saveChatHistory(activeCourseId, {
          courseId: activeCourseId,
          courseName: activeCourseName,
          messages,
          updatedAt: Date.now()
        })
        return
      }

      const parsed = parseMindmapResponse(fullResponse)
      if (!parsed) {
        assistantMsg.content = buildToolParseFailureMessage('思维导图', fullResponse)
        showStatus('未能解析思维导图结构，已展示模型原始输出', 'error')
        renderMessages(messages, overlayElement)
        await saveChatHistory(activeCourseId, {
          courseId: activeCourseId,
          courseName: activeCourseName,
          messages,
          updatedAt: Date.now()
        })
        return
      }

      assistantMsg.mindmap = parsed
      assistantMsg.content = fullResponse
      setActiveMindmapMessageId(assistantMsg.id)
      renderMessages(messages, overlayElement)

      await saveChatHistory(activeCourseId, {
        courseId: activeCourseId,
        courseName: activeCourseName,
        messages,
        updatedAt: Date.now()
      })
    } catch (error) {
      if (isStreamAbortError(error) && run.stoppedByUser) {
        assistantMsg.content = loadingHandle.bufferedText.trim()
          ? `${loadingHandle.bufferedText}\n\n[已手动停止]`
          : '[已手动停止]'
        renderMessages(messages, overlayElement)
        await saveChatHistory(activeCourseId, {
          courseId: activeCourseId,
          courseName: activeCourseName,
          messages,
          updatedAt: Date.now()
        })
      } else {
        console.error('Mindmap generation error:', error)
        const errorMsg = error instanceof Error ? formatErrorMessage(error) : '生成思维导图时发生错误'
        assistantMsg.content = `❌ ${errorMsg}`
        renderMessages(messages, overlayElement)
      }
    } finally {
      finalizeLoadingIndicator(loadingHandle, true)
      clearActiveRun(run)
      setInteractionDisabled(false)
      if (input) input.focus()
    }
  }

  sendBtn?.addEventListener('click', sendChatMessage)
  flashcardSendBtn?.addEventListener('click', sendFlashcardMessage)
  mindmapSendBtn?.addEventListener('click', sendMindmapMessage)

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (currentMode === 'flashcard') {
        void sendFlashcardMessage()
      } else if (currentMode === 'mindmap') {
        void sendMindmapMessage()
      } else {
        void sendChatMessage()
      }
    }
  })

  input?.addEventListener('input', () => adjustTextareaHeight(input))

  // Listen for messages loaded event from courseHandler
  window.addEventListener('xzzd:assistant-messages-load', ((event: CustomEvent) => {
    messages = event.detail.messages || []
    renderMessages(messages, overlayElement)
  }) as EventListener)
}
