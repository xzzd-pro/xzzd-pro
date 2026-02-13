import type { FlashcardData, Flashcard } from "../types/flashcard"

interface FlashcardSessionState {
  queue: Flashcard[]
  original: Flashcard[]
  status: Map<string, number>
  counts: { red: number; yellow: number; green: number }
}

const clampText = (text: string): string => text ?? ""

function escapeHtml(text: string): string {
  return clampText(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatMultiline(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>")
}

function formatWithLatex(text: string): string {
  const blockMath: string[] = []
  const inlineMath: string[] = []

  let processed = clampText(text).replace(/\$\$\s*([\s\S]+?)\s*\$\$/g, (_, formula: string) => {
    blockMath.push(formula)
    return `@@BLOCK_MATH_${blockMath.length - 1}@@`
  })

  processed = processed.replace(/\$([^$\n]+?)\$/g, (_, formula: string) => {
    inlineMath.push(formula)
    return `@@INLINE_MATH_${inlineMath.length - 1}@@`
  })

  let html = escapeHtml(processed).replace(/\n/g, "<br>")

  html = html.replace(/@@BLOCK_MATH_(\d+)@@/g, (_, index: string) => {
    const formula = blockMath[Number(index)]
    const encoded = encodeURIComponent((formula || "").trim())
    return `<div class="flashcard-math-block"><img src="https://latex.codecogs.com/svg.latex?\\Large&space;${encoded}" alt="math" style="filter: var(--math-filter);"></div>`
  })

  html = html.replace(/@@INLINE_MATH_(\d+)@@/g, (_, index: string) => {
    const formula = inlineMath[Number(index)]
    const encoded = encodeURIComponent((formula || "").trim())
    return `<img src="https://latex.codecogs.com/svg.latex?${encoded}" alt="math" class="flashcard-math-inline" style="filter: var(--math-filter);">`
  })

  return html
}

function renderClozeMasked(text: string): string {
  return escapeHtml(text).replace(/{{\s*(.+?)\s*}}/g, '<span class="cloze-blank">_____</span>')
}

function renderClozeHighlighted(text: string): string {
  return escapeHtml(text).replace(/{{\s*(.+?)\s*}}/g, '<span class="cloze-highlight">$1</span>')
}

function detectTfCorrectness(back: string): "correct" | "wrong" {
  const normalized = back.trim().toLowerCase()
  if (normalized.startsWith("true") || normalized.startsWith("正确")) return "correct"
  if (normalized.startsWith("false") || normalized.startsWith("错误")) return "wrong"
  return "correct"
}

function safeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

function renderIcon(name: "deck" | "dot" | "check" | "cross" | "think" | "bulb"): string {
  if (name === "deck") {
    return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm2 0v12h10V5H6zm13 3h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-1h2v1h9v-9h-1V8z"/></svg>'
  }
  if (name === "dot") {
    return '<svg class="icon-svg" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="currentColor"/></svg>'
  }
  if (name === "check") {
    return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.55 18.2 4.8 13.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.7z"/></svg>'
  }
  if (name === "cross") {
    return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.4 19 5 17.6 10.6 12 5 6.4 6.4 5l5.6 5.6L17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19z"/></svg>'
  }
  if (name === "bulb") {
    return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>'
  }
  return '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 17a2 2 0 1 1 2-2 2 2 0 0 1-2 2zm2-6h-4V7h4z"/></svg>'
}

export function renderFlashcardTipBubble(data: FlashcardData, messageId: string): string {
  return `
    <div class="message assistant" id="${messageId}">
      <div class="message-body">
        <div class="flashcard-tip-container">
          <div class="flashcard-tip-icon">
            ${renderIcon("bulb")}
          </div>
          <div class="flashcard-tip-content">
            <div class="flashcard-tip-title">${escapeHtml(data.topic)}</div>
            <div class="flashcard-tip-subtitle">共 ${data.cards.length} 张闪卡</div>
            <div class="flashcard-tip-message">打开左侧侧栏查看完整闪卡</div>
          </div>
        </div>
      </div>
    </div>
  `
}

export function renderFlashcardBubble(data: FlashcardData, messageId: string): string {
  return `
    <div class="message assistant" id="${messageId}">
      <div class="message-body">
        <div class="flashcard-session" data-message-id="${messageId}">
          <div class="flashcard-header">
            <div class="flashcard-topic">${renderIcon("deck")}<span>${escapeHtml(data.topic)}</span></div>
            <div class="flashcard-progress">
              <span class="flashcard-progress-value">剩余: ${data.cards.length} 张</span>
              <span class="flashcard-stats-value">红 0 · 黄 0 · 绿 0</span>
            </div>
          </div>

          <div class="flashcard-stage">
            <div class="flashcard-card" data-side="front">
              <div class="flashcard-face flashcard-front">
                <div class="flashcard-type-tag"></div>
                <div class="flashcard-front-content"></div>
                <div class="flashcard-subtle-hint">点击卡片翻转</div>
              </div>
              <div class="flashcard-face flashcard-back">
                <div class="flashcard-back-content"></div>
                <div class="flashcard-actions">
                  <button class="flashcard-btn danger" data-quality="1">不会</button>
                  <button class="flashcard-btn warning" data-quality="2">模糊</button>
                  <button class="flashcard-btn success" data-quality="3">掌握</button>
                </div>
              </div>
            </div>
          </div>

          <div class="flashcard-overlay hidden">
            <div class="flashcard-overlay-card">
              <div class="flashcard-overlay-title">本次复习完成</div>
              <div class="flashcard-overlay-subtitle">继续巩固或重新开始一轮</div>
              <div class="flashcard-overlay-stats">
                <div class="flashcard-stat red">${renderIcon("dot")}<span class="count">0</span></div>
                <div class="flashcard-stat yellow">${renderIcon("dot")}<span class="count">0</span></div>
                <div class="flashcard-stat green">${renderIcon("dot")}<span class="count">0</span></div>
              </div>
              <button class="flashcard-btn primary" data-action="restart">再练一轮</button>
            </div>
          </div>

          <script type="application/json" class="flashcard-data">${safeJson(data)}</script>
        </div>
      </div>
    </div>
  `
}

function getCurrentCard(state: FlashcardSessionState): Flashcard | undefined {
  return state.queue[0]
}

function updateStatusCounts(state: FlashcardSessionState, cardId: string, quality: number) {
  const prev = state.status.get(cardId)
  if (prev === 1) state.counts.red -= 1
  if (prev === 2) state.counts.yellow -= 1
  if (prev === 3) state.counts.green -= 1

  if (quality === 1) state.counts.red += 1
  if (quality === 2) state.counts.yellow += 1
  if (quality === 3) state.counts.green += 1

  state.status.set(cardId, quality)
}

function renderCardFaces(card: Flashcard) {
  const safeFront = formatWithLatex(card.front)
  const safeBack = formatWithLatex(card.back)

  if (card.type === "cloze") {
    const hasClozeInBack = /{{\s*.+?\s*}}/.test(card.back)
    const highlightedAnswer = hasClozeInBack ? renderClozeHighlighted(card.back) : renderClozeHighlighted(card.front)
    const extraAnswer = hasClozeInBack ? "" : `<div class="flashcard-cloze-extra">${safeBack}</div>`
    return {
      front: `<div class="flashcard-hint">${renderIcon("think")}<span>填空题</span></div><div class="flashcard-question">${renderClozeMasked(card.front)}</div>`,
      back: `<div class="flashcard-hint">${renderIcon("check")}<span>参考答案</span></div><div class="flashcard-answer">${highlightedAnswer}</div>${extraAnswer}`,
      tag: "填空"
    }
  }

  if (card.type === "tf") {
    const correctness = detectTfCorrectness(card.back)
    const resultIcon = correctness === "correct" ? renderIcon("check") : renderIcon("cross")
    const toneClass = correctness === "correct" ? "ok" : "error"
    return {
      front: `<div class="flashcard-hint">${renderIcon("think")}<span>判断正误</span></div><div class="flashcard-question">${safeFront}</div>`,
      back: `<div class="flashcard-tf-result ${toneClass}">${resultIcon} ${safeBack}</div>`,
      tag: "判断"
    }
  }

  return {
    front: `<div class="flashcard-hint">${renderIcon("think")}<span>问答题</span></div><div class="flashcard-question">${safeFront}</div>`,
    back: `<div class="flashcard-hint">${renderIcon("check")}<span>参考答案</span></div><div class="flashcard-answer">${safeBack}</div>`,
    tag: "问答"
  }
}

function setCardContent(sessionEl: HTMLElement, card: Flashcard | undefined) {
  const frontEl = sessionEl.querySelector<HTMLElement>(".flashcard-front-content")
  const backEl = sessionEl.querySelector<HTMLElement>(".flashcard-back-content")
  const tagEl = sessionEl.querySelector<HTMLElement>(".flashcard-type-tag")
  const cardEl = sessionEl.querySelector<HTMLElement>(".flashcard-card")

  if (!cardEl || !frontEl || !backEl || !tagEl) return

  if (!card) {
    frontEl.innerHTML = ""
    backEl.innerHTML = ""
    tagEl.textContent = ""
    return
  }

  const faces = renderCardFaces(card)
  frontEl.innerHTML = faces.front
  backEl.innerHTML = faces.back
  tagEl.textContent = faces.tag
  cardEl.classList.remove("flipped")
  cardEl.setAttribute("data-side", "front")
}

function updateProgress(sessionEl: HTMLElement, state: FlashcardSessionState) {
  const remainingEl = sessionEl.querySelector<HTMLElement>(".flashcard-progress-value")
  const statsEl = sessionEl.querySelector<HTMLElement>(".flashcard-stats-value")
  const overlayEl = sessionEl.querySelector<HTMLElement>(".flashcard-overlay")
  const overlayCounts = overlayEl?.querySelectorAll<HTMLElement>(".flashcard-stat .count")

  if (remainingEl) remainingEl.textContent = `剩余: ${state.queue.length} 张`
  if (statsEl) statsEl.textContent = `红 ${state.counts.red} · 黄 ${state.counts.yellow} · 绿 ${state.counts.green}`

  if (overlayCounts && overlayCounts.length === 3) {
    overlayCounts[0].textContent = String(state.counts.red)
    overlayCounts[1].textContent = String(state.counts.yellow)
    overlayCounts[2].textContent = String(state.counts.green)
  }

  if (overlayEl) {
    if (state.queue.length === 0) {
      overlayEl.classList.remove("hidden")
    } else {
      overlayEl.classList.add("hidden")
    }
  }
}

function createState(data: FlashcardData): FlashcardSessionState {
  return {
    queue: [...data.cards],
    original: [...data.cards],
    status: new Map(),
    counts: { red: 0, yellow: 0, green: 0 }
  }
}

function handleMark(sessionEl: HTMLElement, state: FlashcardSessionState, quality: number) {
  const current = getCurrentCard(state)
  if (!current) return

  state.queue.shift()
  if (quality === 1) {
    state.queue.push(current)
  }

  updateStatusCounts(state, current.id, quality)
  setCardContent(sessionEl, getCurrentCard(state))
  updateProgress(sessionEl, state)
}

function restartSession(sessionEl: HTMLElement, state: FlashcardSessionState) {
  state.queue = [...state.original]
  state.status.clear()
  state.counts = { red: 0, yellow: 0, green: 0 }
  setCardContent(sessionEl, getCurrentCard(state))
  updateProgress(sessionEl, state)
}

function wireEvents(sessionEl: HTMLElement, state: FlashcardSessionState) {
  const cardEl = sessionEl.querySelector<HTMLElement>(".flashcard-card")
  const actionButtons = sessionEl.querySelectorAll<HTMLButtonElement>('.flashcard-actions [data-quality]')
  const restartBtn = sessionEl.querySelector<HTMLButtonElement>('[data-action="restart"]')

  if (cardEl) {
    cardEl.addEventListener("click", () => {
      if (state.queue.length === 0) return
      cardEl.classList.toggle("flipped")
      const side = cardEl.getAttribute("data-side") === "front" ? "back" : "front"
      cardEl.setAttribute("data-side", side)
    })
  }

  actionButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const quality = Number(btn.getAttribute("data-quality"))
      handleMark(sessionEl, state, quality)
    })
  })

  if (restartBtn) {
    restartBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      restartSession(sessionEl, state)
    })
  }
}

export function hydrateFlashcardBubbles(root: HTMLElement | Document = document): void {
  const sessions = Array.from(root.querySelectorAll<HTMLElement>(".flashcard-session")).filter(el => !el.dataset.ready)

  sessions.forEach(sessionEl => {
    const dataScript = sessionEl.querySelector<HTMLScriptElement>(".flashcard-data")
    if (!dataScript) return

    let data: FlashcardData | null = null
    try {
      data = JSON.parse(dataScript.textContent || "") as FlashcardData
    } catch (err) {
      console.error("Failed to parse flashcard data", err)
    }
    if (!data || !Array.isArray(data.cards) || data.cards.length === 0) return

    const state = createState(data)
    setCardContent(sessionEl, getCurrentCard(state))
    updateProgress(sessionEl, state)
    wireEvents(sessionEl, state)

    sessionEl.dataset.ready = "true"
  })
}
