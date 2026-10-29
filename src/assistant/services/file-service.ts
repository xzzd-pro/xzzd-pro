import { strFromU8, unzipSync } from "fflate"
import * as pdfjsLib from "pdfjs-dist"
// @ts-ignore
import workerUrl from "url:pdfjs-dist/build/pdf.worker.min.mjs"

import { fetchBlob } from "./file-fetch"
import { decodeText } from "./text-decode"

/**
 * Downloads a text file and decodes it.
 * @param url File URL.
 * @returns Decoded text.
 * @throws If the server returns an HTML page instead of the file.
 */
export async function fetchTextContent(url: string): Promise<string> {
  const blob = await fetchBlob(url)
  if (blob.type.toLowerCase().includes("text/html")) {
    throw new Error(
      "服务器返回了网页而非文本文件，请确认登录状态或使用原生页面查看。"
    )
  }
  return parseText(blob)
}

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const DEFAULT_PDF_IMAGE_MAX_PAGES = 6
const DEFAULT_PDF_IMAGE_SCALE = 1.25

/**
 * Downloads a file and extracts its text, choosing a parser by extension (PDF, PPTX, DOCX or plain text).
 * @param url File URL.
 * @param filename Name used to pick the parser.
 * @returns Extracted text, or a note explaining why it could not be read.
 */
export async function fetchFileContent(
  url: string,
  filename: string
): Promise<string> {
  try {
    const blob = await fetchBlob(url)
    const ext = filename.split(".").pop()?.toLowerCase() || ""

    if (ext === "pdf") {
      try {
        return await parsePdf(blob)
      } catch (error) {
        console.error("PDF Parse Error:", error)
        return `[PDF 解析失败: ${error instanceof Error ? error.message : String(error)}]`
      }
    }

    if (ext === "pptx") {
      try {
        return await parsePptx(blob)
      } catch (error) {
        console.error("PPTX Parse Error:", error)
        return `[PPTX 解析失败: ${error instanceof Error ? error.message : String(error)}]`
      }
    }

    if (ext === "docx") {
      try {
        return await parseDocx(blob)
      } catch (error) {
        console.error("DOCX Parse Error:", error)
        return `[DOCX 解析失败: ${error instanceof Error ? error.message : String(error)}]`
      }
    }

    if (ext === "doc") {
      return "[DOC 文档暂不支持在线解析，请优先使用 docx 或 pdf]"
    }

    if (ext === "ppt") {
      return "[PPT 文档暂不支持在线解析，请优先使用 pptx 或 pdf]"
    }

    if (
      ["txt", "md", "json", "py", "java", "js", "ts", "c", "cpp", "h"].includes(
        ext
      )
    ) {
      return await parseText(blob)
    }

    return `[文件类型 ${ext} 不支持直接预览内容]`
  } catch (error) {
    console.error("File parsing error:", error)
    return `[读取文件错误: ${error instanceof Error ? error.message : String(error)}]`
  }
}

/**
 * Downloads a PDF.
 * @param url File URL.
 * @returns The PDF, or null if the download fails.
 */
export async function fetchPdfBlob(url: string): Promise<Blob | null> {
  try {
    return await fetchBlob(url)
  } catch (error) {
    console.error(
      "XZZDPRO: " + (error instanceof Error ? error.message : String(error))
    )
    return null
  }
}

/**
 * Renders PDF pages to PNG data URIs, for models that read images better than extracted text.
 * @param blob The PDF.
 * @param options Page limit, render scale, a per-page callback and a cancel check.
 * @returns Data URIs of the rendered pages.
 */
export async function convertPdfToImages(
  blob: Blob,
  options?: {
    maxPages?: number
    scale?: number
    onPageRendered?: (
      imageDataUrl: string,
      pageNumber: number,
      totalPages: number
    ) => void
    shouldContinue?: () => boolean
  }
): Promise<string[]> {
  const arrayBuffer = await blob.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.449/cmaps/",
    cMapPacked: true,
    verbosity: 0
  })
  const pdf = await loadingTask.promise

  const images: string[] = []
  const maxPages = options?.maxPages ?? DEFAULT_PDF_IMAGE_MAX_PAGES
  const scale = options?.scale ?? DEFAULT_PDF_IMAGE_SCALE
  const pageCount = Number.isFinite(maxPages)
    ? Math.min(pdf.numPages, Math.max(0, Math.floor(maxPages)))
    : pdf.numPages

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    if (options?.shouldContinue && !options.shouldContinue()) {
      break
    }

    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const context = canvas.getContext("2d")

    if (context) {
      await page.render({
        canvasContext: context,
        viewport,
        canvas
      }).promise

      const imageDataUrl = canvas.toDataURL("image/png")
      images.push(imageDataUrl)
      options?.onPageRendered?.(imageDataUrl, pageNumber, pageCount)
    }

    canvas.width = 0
    canvas.height = 0
    page.cleanup()
  }

  return images
}

/**
 * Extracts the text of a PDF.
 * @param blob The PDF.
 * @returns Text of all pages.
 */
export async function extractPdfText(blob: Blob): Promise<string> {
  return await parsePdf(blob)
}

async function parseText(blob: Blob): Promise<string> {
  return decodeText(new Uint8Array(await blob.arrayBuffer()))
}

async function parsePdf(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.449/cmaps/",
    cMapPacked: true,
    verbosity: 0
  })
  const pdf = await loadingTask.promise

  let fullText = ""
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item: any) => item.str).join(" ")
    fullText += `--- Page ${i} ---\n${pageText}\n\n`
  }

  return fullText
}

async function parsePptx(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const archive = unzipSync(bytes)
  const slidePaths = Object.keys(archive)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => extractSlideNumber(a) - extractSlideNumber(b))

  if (slidePaths.length === 0) {
    return "[PPTX 解析失败: 未找到幻灯片内容]"
  }

  const sections: string[] = []
  for (const path of slidePaths) {
    const xml = strFromU8(archive[path])
    const texts = extractTextsFromSlideXml(xml)
    const slideNo = extractSlideNumber(path)
    if (texts.length > 0) {
      sections.push(`--- Slide ${slideNo} ---\n${texts.join("\n")}`)
    }
  }

  if (sections.length === 0) {
    return "[PPTX 中未提取到可读文本，可能主要是图片内容]"
  }

  return sections.join("\n\n")
}

async function parseDocx(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const archive = unzipSync(bytes)

  const headerSections = Object.keys(archive)
    .filter((path) => /^word\/header\d+\.xml$/i.test(path))
    .sort()
    .map((path) => extractTextsFromWordXml(archive[path]))
    .filter(Boolean)
    .map((text) => `--- Header ---\n${text}`)

  const bodyText = extractTextsFromWordXml(archive["word/document.xml"])

  const footerSections = Object.keys(archive)
    .filter((path) => /^word\/footer\d+\.xml$/i.test(path))
    .sort()
    .map((path) => extractTextsFromWordXml(archive[path]))
    .filter(Boolean)
    .map((text) => `--- Footer ---\n${text}`)

  const sections = [...headerSections]
  if (bodyText) {
    sections.push(bodyText)
  }
  sections.push(...footerSections)

  if (sections.length === 0) {
    return "[DOCX 中未提取到可读文本，可能主要是图片或扫描内容]"
  }

  return sections.join("\n\n")
}

function extractSlideNumber(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/i)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function extractTextsFromSlideXml(xml: string): string[] {
  const values: string[] = []
  const textRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g
  let match: RegExpExecArray | null = null

  while ((match = textRegex.exec(xml)) !== null) {
    const raw = match[1] || ""
    const decoded = decodeXmlEntities(raw).replace(/\s+/g, " ").trim()
    if (decoded) {
      values.push(decoded)
    }
  }

  const deduped: string[] = []
  for (const value of values) {
    if (deduped[deduped.length - 1] !== value) {
      deduped.push(value)
    }
  }

  return deduped
}

function extractTextsFromWordXml(source?: Uint8Array): string {
  if (!source) return ""

  const xml = strFromU8(source)
  const paragraphRegex = /<w:p\b[\s\S]*?<\/w:p>/g
  const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
  const paragraphs: string[] = []

  let paragraphMatch: RegExpExecArray | null = null
  while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
    const paragraphXml = paragraphMatch[0]
    const parts: string[] = []
    let textMatch: RegExpExecArray | null = null

    while ((textMatch = textRegex.exec(paragraphXml)) !== null) {
      const raw = textMatch[1] || ""
      const decoded = decodeXmlEntities(raw)
      if (decoded) {
        parts.push(decoded)
      }
    }

    const paragraphText = parts.join("").replace(/\s+/g, " ").trim()
    if (paragraphText) {
      paragraphs.push(paragraphText)
    }
  }

  return paragraphs.join("\n").trim()
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_match, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
}
