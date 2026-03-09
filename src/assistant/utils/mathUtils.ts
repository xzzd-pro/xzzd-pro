const PLACEHOLDER_PREFIX = "@@MATH_NORM_"

const INLINE_LATEX_COMMAND_SOURCE =
  String.raw`\\(?:frac|sqrt|sum|int|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|chi|psi|omega|Delta|Gamma|Lambda|Pi|Sigma|Omega|partial|cdot|times|div|leq|geq|neq|approx|sim|infty|rightarrow|leftarrow|leftrightarrow|to|pm|mp|vec|hat|bar|overline|underline|nabla|forall|exists|in|notin)(?:\s*\{[^{}\n]+\}){0,3}(?:\s*[_^]\s*(?:\{[^{}\n]+\}|[A-Za-z0-9]+))*`

function maskSegments(source: string, pattern: RegExp, segments: string[]): string {
  return source.replace(pattern, (match: string) => {
    const placeholder = `${PLACEHOLDER_PREFIX}${segments.length}@@`
    segments.push(match)
    return placeholder
  })
}

function restoreSegments(source: string, segments: string[]): string {
  return source.replace(/@@MATH_NORM_(\d+)@@/g, (_, index: string) => {
    const value = segments[Number(index)]
    return typeof value === "string" ? value : ""
  })
}

function normalizeEscapedDelimiters(text: string): string {
  let normalized = text.replace(/\\\[\s*([\s\S]+?)\s*\\\]/g, (_, formula: string) => {
    return `$$${formula.trim()}$$`
  })

  normalized = normalized.replace(/\\\(\s*([^\n]+?)\s*\\\)/g, (_, formula: string) => {
    return `$${formula.trim()}$`
  })

  return normalized
}

function shouldWrapAsBlockMath(trimmedLine: string): boolean {
  if (!trimmedLine || trimmedLine.includes("$")) return false
  if (trimmedLine.includes(PLACEHOLDER_PREFIX)) return false
  if (trimmedLine.length > 180) return false

  if (/^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\|)/.test(trimmedLine)) return false
  if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmedLine)) return false
  if (/^(https?:\/\/|www\.)/i.test(trimmedLine)) return false

  if (/\\begin\{[^}]+\}|\\end\{[^}]+\}/.test(trimmedLine)) return true

  const commandCount = (trimmedLine.match(/\\[A-Za-z]+/g) || []).length
  const operatorCount = (trimmedLine.match(/[=<>+\-*/^_]/g) || []).length
  const hasBraces = /{[^{}]+}/.test(trimmedLine)
  const cjkCount = (trimmedLine.match(/[\u4e00-\u9fff]/g) || []).length
  const wordCount = (trimmedLine.match(/[A-Za-z]{2,}/g) || []).length

  if (commandCount >= 1 && (operatorCount >= 1 || hasBraces) && cjkCount <= 4 && wordCount <= 12) {
    return true
  }
  if (commandCount >= 2 && cjkCount <= 2) {
    return true
  }

  const looksLikeMathOnly = /^[A-Za-z0-9()[\]{}.,\s+\-*/^_=<>|:]+$/.test(trimmedLine)
  if (!looksLikeMathOnly || cjkCount > 0 || wordCount > 6 || operatorCount < 1) return false

  const signalCount = operatorCount + (trimmedLine.match(/\d/g) || []).length
  return signalCount >= 4
}

function wrapInlineLatexCommands(line: string): string {
  const regex = new RegExp(INLINE_LATEX_COMMAND_SOURCE, "g")
  const chunks: string[] = []
  let cursor = 0
  let matched: RegExpExecArray | null = regex.exec(line)

  while (matched) {
    const value = matched[0]
    const start = matched.index
    const end = start + value.length
    const prev = start > 0 ? line[start - 1] : ""
    const next = end < line.length ? line[end] : ""
    const isBoundarySafe = !/[A-Za-z0-9\\]/.test(prev) && !/[A-Za-z0-9\\]/.test(next)
    const shouldWrap = isBoundarySafe && prev !== "$" && next !== "$"

    chunks.push(line.slice(cursor, start))
    chunks.push(shouldWrap ? `$${value}$` : value)
    cursor = end
    matched = regex.exec(line)
  }

  if (chunks.length === 0) return line
  chunks.push(line.slice(cursor))
  return chunks.join("")
}

function normalizeLine(line: string): string {
  if (!line.trim()) return line
  if (line.includes("$")) return line

  const trimmed = line.trim()
  const leadingSpaces = line.match(/^\s*/)?.[0] || ""

  if (shouldWrapAsBlockMath(trimmed)) {
    return `${leadingSpaces}$$${trimmed}$$`
  }

  return wrapInlineLatexCommands(line)
}

export function normalizeMathDelimiters(text: string): string {
  if (!text) return ""

  const segments: string[] = []
  let normalized = text

  normalized = maskSegments(normalized, /```[\s\S]*?```/g, segments)
  normalized = maskSegments(normalized, /`[^`\n]+`/g, segments)
  normalized = maskSegments(normalized, /!?\[[^\]\n]*\]\([^\)\n]+\)/g, segments)
  normalized = maskSegments(normalized, /https?:\/\/[^\s)\]}]+/g, segments)
  normalized = maskSegments(normalized, /\$\$[\s\S]+?\$\$/g, segments)
  normalized = maskSegments(normalized, /\$[^$\n]+\$/g, segments)

  normalized = normalizeEscapedDelimiters(normalized)
  normalized = normalized
    .split("\n")
    .map((line) => normalizeLine(line))
    .join("\n")

  return restoreSegments(normalized, segments)
}
