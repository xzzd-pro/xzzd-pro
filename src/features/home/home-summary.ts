/**
 * Summary bar at the top of the home page: one sentence that folds the greeting
 * and today's counts together ("早上好，今天有 2 节课，2 项待办即将截止"),
 * the date beneath it, and a random 竺可桢 quote on the side.
 */

export type SummaryStat = "courses" | "dueSoon" | "overdue"

/** undefined = not loaded yet, null = failed to load; both leave their clause out. */
export type SummaryCounts = Partial<Record<SummaryStat, number | null>>

export interface Quote {
  text: string
  source: string
}

/**
 * Words of 竺可桢 (ZJU president 1936-1949, d. 1974, now public domain), one
 * picked at random per visit. Wording follows the 竺可桢语录 section of Zhejiang
 * University's 《竺可桢精神宣传册》; longer passages are trimmed to a continuous
 * excerpt without rewording.
 */
export const QUOTES: Quote[] = [
  { text: "不盲从，不附和，一以理智为依归。", source: "竺可桢" },
  { text: "不屈不挠，不畏强御，只问是非，不计利害。", source: "竺可桢" },
  { text: "虚怀若谷，不武断，不蛮横。", source: "竺可桢" },
  {
    text: "专心一致，实事求是，不作无病之呻吟，严谨整饬，毫不苟且。",
    source: "竺可桢"
  },
  { text: "科学永远对抗着迷信以及一切蒙昧无知的思想。", source: "竺可桢" },
  {
    text: "科学家的态度，应该是知之为知之，不知为不知，丝毫不能苟且。",
    source: "竺可桢"
  },
  {
    text: "大学的最大目标是在蕲求真理，要蕲求真理，必得锻炼思想，使人人能辨别真伪是非。",
    source: "竺可桢"
  },
  {
    text: "科学事业之目的在于求真理。只有求真理，才值得科学家的一番努力。",
    source: "竺可桢"
  },
  { text: "排万难冒百死以求真知。", source: "竺可桢" },
  {
    text: "教育的目的，不但是在改进个人，还要能影响于社会。",
    source: "竺可桢"
  },
  { text: "我们人生的目的是在能服务，而不在享受。", source: "竺可桢" },
  {
    text: "教育的发达，学风的优良，在人不在屋，所谓“斯是陋室，惟吾德馨”。",
    source: "竺可桢"
  },
  {
    text: "若侧重应用的科学，而置纯粹科学、人文科学于不顾，这是谋食而不谋道的办法。",
    source: "竺可桢"
  },
  {
    text: "教授是大学的灵魂，一个大学学风的优劣，全视教授人选为转移。",
    source: "竺可桢"
  },
  {
    text: "第一，到浙大来做什么？第二，将来毕业后要做什么样的人？",
    source: "竺可桢，1936 年对新生谈话"
  }
]

/**
 * A random quote, never the one currently shown (so a click always changes it).
 * `random` is injectable for tests.
 */
export function pickRandomQuote(
  currentText?: string,
  random: () => number = Math.random,
  quotes: Quote[] = QUOTES
): Quote {
  const pool =
    quotes.length > 1
      ? quotes.filter((quote) => quote.text !== currentText)
      : quotes
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/** Days counted as "due soon"; matches the yellow "soon" deadline badge. */
export const DUE_SOON_DAYS = 7

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]

/**
 * Picks a greeting for the time of day.
 * @param now Current time.
 * @returns The greeting.
 */
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
export function countDeadlines(daysLeft: Array<number | null>): {
  dueSoon: number
  overdue: number
} {
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
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const isCount = (value: number | null | undefined): value is number =>
  typeof value === "number"

/**
 * The heading sentence. Clauses appear as their counts arrive; a count that is
 * still loading or failed is left out instead of being shown as 0.
 */
export function composeSummary(
  greeting: string,
  counts: SummaryCounts
): string {
  const clauses: string[] = []
  const { courses, dueSoon, overdue } = counts
  if (isCount(courses)) {
    clauses.push(
      courses > 0 ? `今天有 <strong>${courses}</strong> 节课` : "今天没有课"
    )
  }
  if (isCount(dueSoon) && dueSoon > 0) {
    clauses.push(`<strong>${dueSoon}</strong> 项待办即将截止`)
  } else if (isCount(dueSoon) && isCount(overdue) && overdue === 0) {
    clauses.push("暂无即将截止的待办")
  }
  if (isCount(overdue) && overdue > 0) {
    clauses.push(
      `<span class="home-summary-alert"><strong>${overdue}</strong> 项已过期</span>`
    )
  }
  const lead = `<span class="home-summary-greet">${escapeText(greeting)}</span>`
  // The clauses sit two steps below the greeting; only their numbers keep the full size.
  return clauses.length
    ? `${lead}<span class="home-summary-detail">，${clauses.join("，")}</span>`
    : lead
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
export function setSummaryStat(
  root: ParentNode,
  stat: SummaryStat,
  value: number | null
): void {
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

/**
 * Lets the user click or press Enter/Space on the quote to fade to another random quote.
 * @param root Element that contains the quote figure.
 */
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
