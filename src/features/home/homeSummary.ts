/**
 * Summary bar at the top of the home page: one sentence that folds the greeting
 * and today's counts together ("早上好，今天有 2 节课，2 项待办 7 天内截止"),
 * the date beneath it, and a random quote on the side.
 */

export type SummaryStat = "courses" | "dueSoon" | "overdue"

/** undefined = not loaded yet, null = failed to load; both leave their clause out. */
export type SummaryCounts = Partial<Record<SummaryStat, number | null>>

export interface Quote {
  text: string
  source: string
}

/**
 * Zhejiang University sayings, one picked at random per visit: the motto, the shared values,
 * lines from the school song (lyrics by 马一浮, d. 1967) and words of president
 * 竺可桢 (d. 1974) — all outside copyright.
 */
export const QUOTES: Quote[] = [
  { text: "求是创新", source: "浙江大学校训" },
  { text: "海纳江河，启真厚德，开物前民，树我邦国。", source: "浙江大学共同价值观" },
  { text: "大不自多，海纳江河。", source: "浙江大学校歌" },
  { text: "惟学无际，际于天地。", source: "浙江大学校歌" },
  { text: "形上谓道兮，形下谓器。", source: "浙江大学校歌" },
  { text: "无曰已是，无曰遂真。", source: "浙江大学校歌" },
  { text: "靡革匪因，靡故匪新。", source: "浙江大学校歌" },
  { text: "何以新之，开物前民。", source: "浙江大学校歌" },
  { text: "树我邦国，天下来同。", source: "浙江大学校歌" },
  { text: "只问是非，不计利害。", source: "竺可桢" },
  { text: "到浙大来做什么？将来毕业后做什么样的人？", source: "竺可桢" },
]

/**
 * A random quote, never the one currently shown (so a click always changes it).
 * `random` is injectable for tests.
 */
export function pickRandomQuote(currentText?: string, random: () => number = Math.random, quotes: Quote[] = QUOTES): Quote {
  const pool = quotes.length > 1 ? quotes.filter((quote) => quote.text !== currentText) : quotes
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/** Days counted as "due soon"; matches the yellow "soon" deadline badge. */
export const DUE_SOON_DAYS = 7

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]

export function getGreeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 5) return "夜深了"
  if (hour < 11) return "早上好"
  if (hour < 13) return "中午好"
  if (hour < 18) return "下午好"
  return "晚上好"
}

/** "10月29日 星期四" */
export function formatLongDate(now = new Date()): string {
  return `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAYS[now.getDay()]}`
}

/**
 * Overdue and due-soon counts from the todo list's days-left values
 * (same rounding as the deadline badges: 0 or less is overdue).
 */
export function countDeadlines(daysLeft: Array<number | null>): { dueSoon: number; overdue: number } {
  let dueSoon = 0
  let overdue = 0
  for (const days of daysLeft) {
    if (days === null) continue
    if (days <= 0) overdue += 1
    else if (days <= DUE_SOON_DAYS) dueSoon += 1
  }
  return { dueSoon, overdue }
}

const escapeText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const isCount = (value: number | null | undefined): value is number => typeof value === "number"

/**
 * The heading sentence. Clauses appear as their counts arrive; a count that is
 * still loading or failed is left out instead of being shown as 0.
 */
export function composeSummary(greeting: string, counts: SummaryCounts): string {
  const clauses: string[] = []
  const { courses, dueSoon, overdue } = counts
  if (isCount(courses)) {
    clauses.push(courses > 0 ? `今天有 <strong>${courses}</strong> 节课` : "今天没有课")
  }
  if (isCount(dueSoon) && dueSoon > 0) {
    clauses.push(`<strong>${dueSoon}</strong> 项待办即将截止`)
  } else if (isCount(dueSoon) && isCount(overdue) && overdue === 0) {
    clauses.push("暂无即将截止的待办")
  }
  if (isCount(overdue) && overdue > 0) {
    clauses.push(`<span class="home-summary-alert"><strong>${overdue}</strong> 项已过期</span>`)
  }
  const lead = `<span class="home-summary-greet">${escapeText(greeting)}</span>`
  // The clauses sit two steps below the greeting; only their numbers keep the full size.
  return clauses.length ? `${lead}<span class="home-summary-detail">，${clauses.join("，")}</span>` : lead
}

/** Heading and date; counts are filled in later through setSummaryStat. */
export function renderSummaryHeading(now = new Date()): string {
  const greeting = getGreeting(now)
  return `
    <div class="home-summary-main">
      <h2 class="home-summary-title" data-greeting="${escapeText(greeting)}" aria-live="polite">${composeSummary(greeting, {})}</h2>
      <p class="home-summary-date">${formatLongDate(now)}</p>
    </div>
  `
}

/** Records one count on the heading and re-renders the sentence. null means the data failed to load. */
export function setSummaryStat(root: ParentNode, stat: SummaryStat, value: number | null): void {
  const title = root.querySelector<HTMLElement>(".home-summary-title")
  if (!title) return
  title.dataset[stat] = value === null ? "failed" : String(value)
  const read = (key: SummaryStat): number | null | undefined => {
    const raw = title.dataset[key]
    if (raw === undefined) return undefined
    return raw === "failed" ? null : Number(raw)
  }
  title.innerHTML = composeSummary(title.dataset.greeting || "", {
    courses: read("courses"),
    dueSoon: read("dueSoon"),
    overdue: read("overdue")
  })
}

const quoteTitle = (quote: Quote) => `${quote.text} —— ${quote.source}
点击换一句`

/** A random quote; click (or Enter/Space when focused) swaps it via setupQuoteRotation. */
export function renderQuote(quote: Quote = pickRandomQuote()): string {
  return `
    <figure class="home-summary-quote" role="button" tabindex="0" aria-label="换一句语录" title="${escapeText(quoteTitle(quote))}">
      <blockquote>${escapeText(quote.text)}</blockquote>
      <figcaption>—— ${escapeText(quote.source)}</figcaption>
    </figure>
  `
}

const QUOTE_FADE_MS = 150

export function setupQuoteRotation(root: ParentNode): void {
  const figure = root.querySelector<HTMLElement>(".home-summary-quote")
  const text = figure?.querySelector<HTMLElement>("blockquote")
  const source = figure?.querySelector<HTMLElement>("figcaption")
  if (!figure || !text || !source) return
  let swapping = false
  const swap = () => {
    if (swapping) return
    swapping = true
    const next = pickRandomQuote(text.textContent ?? undefined)
    figure.classList.add("is-fading")
    window.setTimeout(() => {
      text.textContent = next.text
      source.textContent = `—— ${next.source}`
      figure.title = quoteTitle(next)
      figure.classList.remove("is-fading")
      swapping = false
    }, QUOTE_FADE_MS)
  }
  figure.addEventListener("click", swap)
  figure.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    swap()
  })
}
