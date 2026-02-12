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

export function renderFlashcardBubble(data: FlashcardData, messageId: string): string {
  return `
    <div class="message assistant" id="${messageId}">
      <div class="message-body">
        <div class="flashcard-session" data-message-id="${messageId}">
          <div class="flashcard-header">
            <div class="flashcard-topic">🎴 ${escapeHtml(data.topic)}</div>
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
                <div class="flashcard-stat red">🔴 <span class="count">0</span></div>
                <div class="flashcard-stat yellow">🟡 <span class="count">0</span></div>
                <div class="flashcard-stat green">🟢 <span class="count">0</span></div>
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
  const safeFront = escapeHtml(card.front)
  const safeBack = formatMultiline(card.back)

  if (card.type === "cloze") {
    return {
      front: renderClozeMasked(card.front),
      back: renderClozeHighlighted(card.back),
      tag: "填空"
    }
  }

  if (card.type === "tf") {
    const correctness = detectTfCorrectness(card.back)
    const resultIcon = correctness === "correct" ? "✅" : "❌"
    const toneClass = correctness === "correct" ? "ok" : "error"
    return {
      front: `<div class="flashcard-hint">🤔 判断正误</div><div class="flashcard-question">${safeFront}</div>`,
      back: `<div class="flashcard-tf-result ${toneClass}">${resultIcon} ${safeBack}</div>`,
      tag: "判断"
    }
  }

  return {
    front: `<div class="flashcard-question">${safeFront}</div>`,
    back: `<div class="flashcard-answer">${safeBack}</div>`,
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
