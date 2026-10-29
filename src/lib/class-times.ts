const SLOT_PATTERN = /^(周[一二三四五六日天])\s*第?\s*([\d,，、\s-]+)\s*节$/

function formatPeriods(periods: number[]): string {
  const sorted = [...new Set(periods)].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]
  let previous = sorted[0]
  for (const period of [...sorted.slice(1), NaN]) {
    if (period === previous + 1) {
      previous = period
      continue
    }
    ranges.push(start === previous ? `${start}` : `${start}–${previous}`)
    start = period
    previous = period
  }
  return ranges.join(",")
}

/**
 * Splits a class time string from the course list into short labels, e.g.
 * "周二第3,4,5节;周四第3,4节" → ["周二 3–5 节", "周四 3–4 节"].
 * Parts that do not look like a weekday and periods are kept as written.
 * @param value The course's `teaching_class_name`.
 * @returns One label per time slot; empty when there is no value.
 */
export function formatClassTimes(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(/[;；]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(SLOT_PATTERN)
      if (!match) return part
      const periods = match[2].split(/[,，、\s]+/).flatMap((token) => {
        const [from, to] = token.split("-").map(Number)
        if (!Number.isInteger(from)) return []
        if (!Number.isInteger(to)) return [from]
        return Array.from(
          { length: Math.max(0, to - from) + 1 },
          (_, i) => from + i
        )
      })
      return periods.length ? `${match[1]} ${formatPeriods(periods)} 节` : part
    })
}
