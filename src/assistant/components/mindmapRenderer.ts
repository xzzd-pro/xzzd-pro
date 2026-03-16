import type { MindmapData } from "../types/mindmap"
import { Markmap } from "markmap-view"
import { Transformer } from "markmap-lib"

type MarkmapInstance = ReturnType<typeof Markmap.create>

interface MindmapBinding {
  svg: SVGSVGElement
  instance: MarkmapInstance
}

interface MindmapOption {
  id: string
  title: string
}

interface MindmapRenderOptions {
  options?: MindmapOption[]
  activeId?: string
}

interface MindmapNode {
  payload?: {
    fold?: number
    [key: string]: unknown
  }
  children?: MindmapNode[]
}

const DEFAULT_TITLE = "学习导图"
const mindmapBindings = new Map<string, MindmapBinding>()

function clampText(text: string): string {
  return text ?? ""
}

function escapeHtml(text: string): string {
  return clampText(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function safeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

function sanitizeMarkdown(markdown: string): string {
  return clampText(markdown).replace(/<[^>]*>/g, "").trim()
}

function sanitizeTitle(title: string): string {
  return clampText(title).replace(/[#*_`\[\]]/g, "").trim() || DEFAULT_TITLE
}

function normalizeMarkdown(data: MindmapData): string {
  const markdown = sanitizeMarkdown(data.markdown)
  if (!markdown) return ""

  const hasHeading = /^#{1,6}\s+\S/m.test(markdown)
  if (hasHeading) return markdown

  return `# ${sanitizeTitle(data.title)}\n\n${markdown}`
}

function extractTitle(data: MindmapData): string {
  const markdown = sanitizeMarkdown(data.markdown)
  const headingMatch = markdown.match(/^#{1,6}\s+(.+)$/m)
  if (headingMatch?.[1]) {
    return sanitizeTitle(headingMatch[1])
  }
  return sanitizeTitle(data.title)
}

function isLikelyMindmapMarkdown(markdown: string): boolean {
  const hasHeading = /^#{1,6}\s+\S/m.test(markdown)
  const hasList = /^\s*[-*+]\s+\S/m.test(markdown) || /^\s*\d+\.\s+\S/m.test(markdown)
  return hasHeading || hasList
}

function renderIcon(name: "mindmap" | "fit" | "expand" | "collapse" | "rename" | "delete" | "chevron"): string {
  if (name === "fit") {
    return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3H3v4h2V5h2V3zm14 0h-4v2h2v2h2V3zM5 17H3v4h4v-2H5v-2zm16 0h-2v2h-2v2h4v-4zM7 7h10v10H7V7z"/></svg>'
  }
  if (name === "expand") {
    return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>'
  }
  if (name === "collapse") {
    return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 11h14v2H5z"/></svg>'
  }
  if (name === "rename") {
    return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm18-11.5a1 1 0 0 0 0-1.41l-1.34-1.34a1 1 0 0 0-1.41 0l-1.05 1.05 3.75 3.75L21 5.75z"/></svg>'
  }
  if (name === "delete") {
    return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 7h12v2H6V7zm2 3h8l-.7 9.2a2 2 0 0 1-2 1.8h-2.6a2 2 0 0 1-2-1.8L8 10zm2-6h4l1 1h4v2H5V5h4l1-1z"/></svg>'
  }
  if (name === "chevron") {
    return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>'
  }
  return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM5 11a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm14 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 16a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-1-8v3H8v2h3v3h2v-3h3v-2h-3V8h-2Z"/></svg>'
}

function walkMindmap(node: MindmapNode, visitor: (current: MindmapNode, depth: number) => void, depth: number = 0): void {
  visitor(node, depth)
  for (const child of node.children || []) {
    walkMindmap(child, visitor, depth + 1)
  }
}

function setMindmapFoldState(root: MindmapNode, folded: boolean): void {
  walkMindmap(root, (node, depth) => {
    const payload = node.payload || {}
    // Keep root expanded, fold/unfold descendants.
    node.payload = {
      ...payload,
      fold: depth === 0 ? 0 : (folded ? 1 : 0)
    }
  })
}

async function updateMindmapByState(messageId: string, folded: boolean): Promise<void> {
  const binding = mindmapBindings.get(messageId)
  if (!binding) return
  const root = binding.instance.state?.data
  if (!root) return
  setMindmapFoldState(root, folded)
  await binding.instance.renderData?.(root)
}

function cleanupDetachedBindings() {
  for (const [messageId, binding] of mindmapBindings.entries()) {
    if (binding.svg.isConnected) continue
    try {
      binding.instance.destroy?.()
    } catch {
      // Ignore destroy errors for detached nodes.
    }
    mindmapBindings.delete(messageId)
  }
}

function setFallback(sessionEl: HTMLElement, title: string, message: string) {
  const wrap = sessionEl.querySelector<HTMLElement>(".mindmap-canvas-wrap")
  if (!wrap) return
  wrap.innerHTML = `
    <div class="mindmap-fallback">
      <div class="mindmap-fallback-title">${escapeHtml(title)}</div>
      <div class="mindmap-fallback-message">${escapeHtml(message)}</div>
    </div>
  `
}

let globalMindmapMenuEventsBound = false

function closeAllSwitcherMenus(exceptContainer?: HTMLElement): void {
  document.querySelectorAll<HTMLElement>('.mindmap-switcher-container.open').forEach(container => {
    if (exceptContainer && container === exceptContainer) return
    container.classList.remove('open')
    const toggle = container.querySelector<HTMLButtonElement>('[data-action="mindmap-switcher-toggle"]')
    toggle?.setAttribute('aria-expanded', 'false')
  })
}

function bindGlobalMenuDismissEvents(): void {
  if (globalMindmapMenuEventsBound) return
  globalMindmapMenuEventsBound = true

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('.mindmap-switcher-container')) return
    closeAllSwitcherMenus()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    closeAllSwitcherMenus()
  })
}

function wireSessionEvents(sessionEl: HTMLElement, messageId: string) {
  if (sessionEl.dataset.eventsReady === "true") return

  sessionEl.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const actionEl = target?.closest<HTMLElement>('[data-action]')
    if (!actionEl || !sessionEl.contains(actionEl)) return

    const action = actionEl.dataset.action || ''
    if (!action) return
    event.stopPropagation()

    if (action === 'mindmap-switcher-toggle') {
      event.preventDefault()
      const container = actionEl.closest<HTMLElement>('.mindmap-switcher-container')
      if (!container) return
      const shouldOpen = !container.classList.contains('open')
      closeAllSwitcherMenus(shouldOpen ? container : undefined)
      container.classList.toggle('open', shouldOpen)
      actionEl.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false')
      return
    }

    if (action === 'mindmap-select') {
      event.preventDefault()
      const selectedId = actionEl.dataset.messageId || ''
      if (!selectedId) return
      closeAllSwitcherMenus()
      if (selectedId === messageId) return
      window.dispatchEvent(new CustomEvent('xzzd:assistant-mindmap-select', {
        detail: { messageId: selectedId }
      }))
      return
    }

    if (action === 'mindmap-fit') {
      const binding = mindmapBindings.get(messageId)
      binding?.instance.fit?.()
      return
    }

    if (action === 'mindmap-expand-all') {
      void updateMindmapByState(messageId, false)
      return
    }

    if (action === 'mindmap-collapse-all') {
      void updateMindmapByState(messageId, true)
      return
    }

    if (action === 'mindmap-rename') {
      window.dispatchEvent(new CustomEvent('xzzd:assistant-mindmap-rename', {
        detail: { messageId }
      }))
      return
    }

    if (action === 'mindmap-delete') {
      window.dispatchEvent(new CustomEvent('xzzd:assistant-mindmap-delete', {
        detail: { messageId }
      }))
    }
  })

  sessionEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    closeAllSwitcherMenus()
  })

  sessionEl.dataset.eventsReady = "true"
}

export function renderMindmapTipBubble(data: MindmapData, messageId: string): string {
  const title = extractTitle(data)
  return `
    <div class="message assistant" id="${messageId}">
      <div class="message-body">
        <div class="mindmap-tip-container">
          <div class="mindmap-tip-icon">
            ${renderIcon("mindmap")}
          </div>
          <div class="mindmap-tip-content">
            <div class="mindmap-tip-title">${escapeHtml(title)}</div>
            <div class="mindmap-tip-subtitle">思维导图已生成</div>
            <div class="mindmap-tip-message">已生成导图，请在左侧导图标签查看</div>
          </div>
        </div>
      </div>
    </div>
  `
}

export function renderMindmapBubble(data: MindmapData, messageId: string, options: MindmapRenderOptions = {}): string {
  const title = extractTitle(data)
  const allOptions = options.options || [{ id: messageId, title }]
  const selectedId = options.activeId || messageId
  const optionsHtml = allOptions
    .map((item) => {
      const itemTitle = sanitizeTitle(item.title) || DEFAULT_TITLE
      const isActive = item.id === selectedId
      const activeClass = isActive ? ' active' : ''
      const selectedAttr = isActive ? ' aria-current="true"' : ''
      return `
        <button type="button" class="mindmap-switcher-item${activeClass}" data-action="mindmap-select" data-message-id="${escapeHtml(item.id)}" role="menuitem"${selectedAttr}>
          <span class="mindmap-switcher-item-title">${escapeHtml(itemTitle)}</span>
        </button>
      `
    })
    .join('')

  return `
    <div class="message assistant" id="${messageId}">
      <div class="message-body">
        <div class="mindmap-session" data-message-id="${messageId}">
          <div class="mindmap-header">
            <div class="mindmap-topic-group">
              <div class="mindmap-switcher-container">
                <button type="button" class="mindmap-title-switcher" data-action="mindmap-switcher-toggle" aria-label="切换思维导图" aria-haspopup="menu" aria-expanded="false">
                  ${renderIcon("mindmap")}
                  <span class="mindmap-title-text">${escapeHtml(title)}</span>
                  <span class="mindmap-switcher-arrow">${renderIcon("chevron")}</span>
                </button>
                <div class="mindmap-switcher-menu" data-role="mindmap-switcher-menu" role="menu" aria-label="导图列表">
                  ${optionsHtml}
                </div>
              </div>
            </div>
            <div class="mindmap-toolbar">
              <button type="button" class="mindmap-tool-btn" data-action="mindmap-rename" title="修改导图标题">
                ${renderIcon("rename")}
                <span>改标题</span>
              </button>
              <button type="button" class="mindmap-tool-btn danger" data-action="mindmap-delete" title="删除当前导图">
                ${renderIcon("delete")}
                <span>删除</span>
              </button>
              <button type="button" class="mindmap-tool-btn" data-action="mindmap-expand-all" title="展开全部节点">
                ${renderIcon("expand")}
                <span>展开全部</span>
              </button>
              <button type="button" class="mindmap-tool-btn" data-action="mindmap-collapse-all" title="收缩全部节点">
                ${renderIcon("collapse")}
                <span>收缩全部</span>
              </button>
              <button type="button" class="mindmap-tool-btn" data-action="mindmap-fit" title="重置视图">
                ${renderIcon("fit")}
                <span>重置视图</span>
              </button>
            </div>
          </div>
          <div class="mindmap-canvas-wrap">
            <svg class="mindmap-canvas" role="img" aria-label="${escapeHtml(title)}"></svg>
          </div>
          <script type="application/json" class="mindmap-data">${safeJson({
            ...data,
            title
          })}</script>
        </div>
      </div>
    </div>
  `
}

export async function hydrateMindmapBubbles(root: HTMLElement | Document = document): Promise<void> {
  cleanupDetachedBindings()
  bindGlobalMenuDismissEvents()

  const sessions = Array.from(root.querySelectorAll<HTMLElement>(".mindmap-session")).filter(el => !el.dataset.ready)
  if (!sessions.length) return

  let transformer: Transformer | null = null

  for (const sessionEl of sessions) {
    const messageId = sessionEl.dataset.messageId || `mindmap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const dataScript = sessionEl.querySelector<HTMLScriptElement>(".mindmap-data")
    const svg = sessionEl.querySelector<SVGSVGElement>(".mindmap-canvas")
    wireSessionEvents(sessionEl, messageId)

    if (!dataScript || !svg) {
      sessionEl.dataset.ready = "true"
      continue
    }

    let data: MindmapData | null = null
    try {
      data = JSON.parse(dataScript.textContent || "") as MindmapData
    } catch (error) {
      console.error("Failed to parse mindmap data", error)
    }

    if (!data) {
      setFallback(sessionEl, DEFAULT_TITLE, "导图数据解析失败")
      sessionEl.dataset.ready = "true"
      continue
    }

    const normalizedMarkdown = normalizeMarkdown(data)
    const title = extractTitle(data)
    if (!isLikelyMindmapMarkdown(normalizedMarkdown)) {
      setFallback(sessionEl, title, "导图内容格式无效，请重试生成")
      sessionEl.dataset.ready = "true"
      continue
    }

    if (!transformer) {
      transformer = new Transformer()
    }

    try {
      const previous = mindmapBindings.get(messageId)
      if (previous) {
        previous.instance.destroy?.()
        mindmapBindings.delete(messageId)
      }

      const transformed = transformer.transform(normalizedMarkdown)
      const instance = Markmap.create(svg, {
        autoFit: false,
        duration: 250,
        zoom: true,
        pan: true
      }, transformed.root)

      mindmapBindings.set(messageId, { svg, instance })
      window.setTimeout(() => {
        const binding = mindmapBindings.get(messageId)
        binding?.instance.fit?.()
      }, 0)
    } catch (error) {
      console.error("Failed to render mindmap", error)
      setFallback(sessionEl, title, "导图渲染失败，请稍后重试")
    }

    sessionEl.dataset.ready = "true"
  }
}
