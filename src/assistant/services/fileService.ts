import * as pdfjsLib from 'pdfjs-dist'

// @ts-ignore
import workerUrl from "url:pdfjs-dist/build/pdf.worker.min.mjs"

// Configure worker locally
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_IMAGE_PAGES = 10 // Limit pages to prevent huge payloads

export async function fetchFileContent(url: string, filename: string): Promise<string> {
    try {
        const response = await fetch(url, { credentials: 'include' })
        if (!response.ok) {
            // Log the actual status text for debugging
            return `[下载失败: ${response.status} ${response.statusText}]`
        }

        const blob = await response.blob()
        const ext = filename.split('.').pop()?.toLowerCase() || ''

        if (ext === 'pdf') {
            try {
                return await parsePdf(blob)
            } catch (e) {
                console.error('PDF Parse Error:', e)
                return `[PDF解析失败: ${e instanceof Error ? e.message : String(e)}]`
            }
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
        const response = await fetch(url, { credentials: 'include' })
        if (!response.ok) return null
        return await response.blob()
    } catch {
        return null
    }
}

/**
 * Convert PDF pages to base64 images for multimodal LLM input.
 * Returns array of data URIs (image/png).
 */
export async function convertPdfToImages(blob: Blob): Promise<string[]> {
    const arrayBuffer = await blob.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.449/cmaps/',
        cMapPacked: true,
    })
    const pdf = await loadingTask.promise

    const images: string[] = []
    const pageCount = Math.min(pdf.numPages, MAX_IMAGE_PAGES)

    for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.5 }) // Higher scale for readability

        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const context = canvas.getContext('2d')

        if (context) {
            await page.render({ canvasContext: context, viewport }).promise
            images.push(canvas.toDataURL('image/png'))
        }
    }

    return images
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

