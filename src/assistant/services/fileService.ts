import * as pdfjsLib from 'pdfjs-dist'
import { sendToBackground } from "@plasmohq/messaging"
import { unzipSync, strFromU8 } from 'fflate'

// @ts-ignore
import workerUrl from "url:pdfjs-dist/build/pdf.worker.min.mjs"

// Configure worker locally
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const DEFAULT_PDF_IMAGE_MAX_PAGES = 6 // Limit pages to prevent huge payloads
const DEFAULT_PDF_IMAGE_SCALE = 1.25

async function fetchBlobViaBackground(url: string): Promise<Blob> {
    const res = await sendToBackground({
        name: "fetch-file",
        body: { url }
    })

    if (res.error) {
        throw new Error(res.error)
    }

    if (!res.dataUri) {
        throw new Error("No data received")
    }

    // Convert Data URI to Blob
    const response = await fetch(res.dataUri)
    return await response.blob()
}

export async function fetchFileContent(url: string, filename: string): Promise<string> {
    try {
        // Use background fetch to bypass CORS
        const blob = await fetchBlobViaBackground(url)
        const ext = filename.split('.').pop()?.toLowerCase() || ''

        if (ext === 'pdf') {
            try {
                return await parsePdf(blob)
            } catch (e) {
                console.error('PDF Parse Error:', e)
                return `[PDF解析失败: ${e instanceof Error ? e.message : String(e)}]`
            }
        } else if (ext === 'pptx') {
            try {
                return await parsePptx(blob)
            } catch (e) {
                console.error('PPTX Parse Error:', e)
                return `[PPTX解析失败: ${e instanceof Error ? e.message : String(e)}]`
            }
        } else if (ext === 'ppt') {
            return '[文件类型 ppt 暂不支持解析，请先转换为 pptx 或 pdf]'
        } else if (['txt', 'md', 'json', 'py', 'java', 'js', 'ts', 'c', 'cpp', 'h'].includes(ext)) {
            return await parseText(blob)
        } else {
            return `[文件类型 ${ext} 不支持直接预览内容]`
        }
    } catch (error) {
        console.error('File parsing error:', error)
        return `[读取文件错误: ${error instanceof Error ? error.message : String(error)}]`
    }
}

/**
 * Fetch PDF as Blob (for later image conversion)
 */
export async function fetchPdfBlob(url: string): Promise<Blob | null> {
    try {
        return await fetchBlobViaBackground(url)
    } catch {
        return null
    }
}

/**
 * Convert PDF pages to base64 images for multimodal LLM input.
 * Returns array of data URIs (image/png).
 */
export async function convertPdfToImages(
    blob: Blob,
    options?: { maxPages?: number; scale?: number }
): Promise<string[]> {
    const arrayBuffer = await blob.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.449/cmaps/',
        cMapPacked: true,
        verbosity: 0
    })
    const pdf = await loadingTask.promise

    const images: string[] = []
    const maxPages = options?.maxPages ?? DEFAULT_PDF_IMAGE_MAX_PAGES
    const scale = options?.scale ?? DEFAULT_PDF_IMAGE_SCALE
    const pageCount = Math.min(pdf.numPages, maxPages)

    for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale })

        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const context = canvas.getContext('2d')

        if (context) {
            await page.render({ 
                canvasContext: context, 
                viewport,
                canvas: canvas
            }).promise
            images.push(canvas.toDataURL('image/png'))
        }
    }

    return images
}

export async function extractPdfText(blob: Blob): Promise<string> {
    return await parsePdf(blob)
}

async function parseText(blob: Blob): Promise<string> {
    return await blob.text()
}

async function parsePdf(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.449/cmaps/',
        cMapPacked: true,
        verbosity: 0
    })
    const pdf = await loadingTask.promise

    let fullText = ''

    // Iterate over all pages
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')

        fullText += `-- - Page ${i} ---\n${pageText} \n\n`
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
        return '[PPTX 解析失败: 未找到幻灯片内容]'
    }

    const sections: string[] = []
    for (const path of slidePaths) {
        const xml = strFromU8(archive[path])
        const texts = extractTextsFromSlideXml(xml)
        const slideNo = extractSlideNumber(path)
        if (texts.length > 0) {
            sections.push(`--- Slide ${slideNo} ---\n${texts.join('\n')}`)
        }
    }

    if (sections.length === 0) {
        return '[PPTX 中未提取到可读文本，可能为纯图片幻灯片]'
    }

    return sections.join('\n\n')
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
        const raw = match[1] || ''
        const decoded = decodeXmlEntities(raw).replace(/\s+/g, ' ').trim()
        if (decoded) values.push(decoded)
    }

    const deduped: string[] = []
    for (const value of values) {
        if (deduped[deduped.length - 1] !== value) {
            deduped.push(value)
        }
    }
    return deduped
}

function decodeXmlEntities(input: string): string {
    return input
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
}
