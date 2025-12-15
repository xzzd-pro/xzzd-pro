import type { CourseContext, MaterialFile } from '../types'
import { fetchFileContent, fetchPdfBlob, convertPdfToImages } from './fileService'

const SYSTEM_PROMPT_TEMPLATE = `你是一个学习助理，专门帮助学生理解课程内容。

规则：
1. 只基于以下课程资料回答问题，不要延伸额外知识点
2. 如果资料中没有相关内容，请明确告知学生"课程资料中没有找到相关内容"
3. 回答要简洁明了，适合学习场景
4. 使用与学生问题相同的语言回答
5. 如果提供了课件图片，请仔细查看图片内容来回答问题

当前课程：{courseName}

课程资料：
{context}`

// In-memory cache for file contents (text)
const fileContentCache = new Map<string, string>()

// In-memory cache for visual contents (images from image-only PDFs)
export interface VisualContent {
    filename: string
    images: string[] // base64 data URIs
}
const visualContentCache = new Map<string, VisualContent>()

export async function buildSystemPrompt(context: CourseContext, onProgress?: (msg: string) => void): Promise<string> {
    const contextText = await formatContextToText(context, onProgress)
    return SYSTEM_PROMPT_TEMPLATE
        .replace('{courseName}', context.courseName)
        .replace('{context}', contextText)
}

/**
 * Get visual context (images) for multimodal LLM input.
 * Returns list of visual content items.
 */
export function getVisualContext(): VisualContent[] {
    return Array.from(visualContentCache.values())
}

export async function preloadCourseContext(context: CourseContext, onProgress?: (msg: string, type?: 'success' | 'error' | 'info') => void): Promise<void> {
    // Iterate through all files and prime the cache
    if (context.materials.length > 0) {
        let fileCount = 0;
        for (const material of context.materials) {
            if (material.files && material.files.length > 0) {
                fileCount += material.files.length;
            }
        }

        // Log start
        if (onProgress && fileCount > 0) {
            onProgress(`开始预加载课程资料 (共 ${fileCount} 个文件)...`, 'info');
        }

        for (const material of context.materials) {
            if (material.files && material.files.length > 0) {
                for (const file of material.files) {
                    const ext = file.name.split('.').pop()?.toLowerCase() || ''
                    // Check if valid type
                    if (['pdf', 'txt', 'md', 'java', 'py', 'js', 'ts', 'c', 'cpp', 'cc', 'h', 'hpp', 'cs', 'go', 'rs', 'swift', 'kt', 'scala', 'rb', 'php', 'sh', 'bat', 'cmd', 'ps1'].includes(ext)) {
                        // Check cache
                        if (fileContentCache.has(file.downloadUrl) || visualContentCache.has(file.downloadUrl)) {
                            continue;
                        }

                        try {
                            if (onProgress) onProgress(`正在读取: ${file.name}`, 'info')
                            const content = await fetchFileContent(file.downloadUrl, file.name)

                            if (content.startsWith('[') && content.includes('失败')) {
                                // Failed
                                if (onProgress) onProgress(`读取失败: ${file.name}`, 'error')
                            } else if (!content || content.trim().length < 50) {
                                // Too short - likely an image PDF
                                if (ext === 'pdf') {
                                    if (onProgress) onProgress(`检测到图片PDF: ${file.name}，正在转换...`, 'info')
                                    // Try to convert to images
                                    const blob = await fetchPdfBlob(file.downloadUrl)
                                    if (blob) {
                                        const images = await convertPdfToImages(blob)
                                        if (images.length > 0) {
                                            visualContentCache.set(file.downloadUrl, {
                                                filename: file.name,
                                                images
                                            })
                                            if (onProgress) onProgress(`已转换为图片: ${file.name} (${images.length} 页)`, 'success')
                                        } else {
                                            if (onProgress) onProgress(`转换失败: ${file.name}`, 'error')
                                        }
                                    }
                                } else {
                                    if (onProgress) onProgress(`忽略空文件: ${file.name}`, 'info')
                                    fileContentCache.set(file.downloadUrl, `[文件内容过短或为空，已忽略]`)
                                }
                            } else {
                                // Success
                                fileContentCache.set(file.downloadUrl, content)
                                if (onProgress) onProgress(`已读取: ${file.name}`, 'success')
                            }
                        } catch (e) {
                            if (onProgress) onProgress(`读取出错: ${file.name}`, 'error')
                        }
                    }
                }
            }
        }

        if (onProgress && fileCount > 0) {
            onProgress(`课程资料预加载完成`, 'success');
            // Hide after a delay? logic handled in UI
        }
    }
}

async function formatContextToText(context: CourseContext, onProgress?: (msg: string) => void): Promise<string> {
    const parts: string[] = []

    if (context.materials.length > 0) {
        parts.push('【课件资料】')
        for (const material of context.materials) {
            let line = `- ${material.title}`
            if (material.description) {
                line += `：${truncateText(material.description, 200)}`
            }
            if (material.files && material.files.length > 0) {
                line += `\n  包含文件：${material.files.map(f => f.name).join(', ')}`

                // Fetch full content for files
                for (const file of material.files) {
                    const ext = file.name.split('.').pop()?.toLowerCase() || ''
                    if (['pdf', 'txt', 'md', 'java', 'py', 'js', 'ts', 'c', 'cpp', 'cc', 'h', 'hpp', 'cs', 'go', 'rs', 'swift', 'kt', 'scala', 'rb', 'php', 'sh', 'bat', 'cmd', 'ps1'].includes(ext)) {
                        line += `\n\n  --- 文件内容: ${file.name} ---\n`

                        // Check cache first
                        if (fileContentCache.has(file.downloadUrl)) {
                            // Cache hit - use it silently
                            line += fileContentCache.get(file.downloadUrl)
                        } else {
                            // Cache miss - fetch it (should rarely happen if preloaded)
                            try {
                                if (onProgress) onProgress(`正在读取文件: ${file.name}...`)
                                const content = await fetchFileContent(file.downloadUrl, file.name)

                                if (content.startsWith('[') && content.includes('失败')) {
                                    if (onProgress) onProgress(`❌ 读取失败: ${file.name} - ${content}`)
                                    line += `  (文件读取失败: ${content})`
                                } else if (!content || content.trim().length < 50) {
                                    // Stricter check: < 50 chars
                                    // Check if we have visual content for this file
                                    if (visualContentCache.has(file.downloadUrl)) {
                                        const visual = visualContentCache.get(file.downloadUrl)
                                        line += `  [此文件为图片PDF，包含 ${visual?.images.length} 页图片，请查看附带的图片内容]`
                                        if (onProgress) onProgress(`✅ 已启用图片模式: ${file.name} (${visual?.images.length} 页)`)
                                    } else {
                                        // Try to detect and convert if not already cached (JIT conversion for lazy loading)
                                        try {
                                            if (ext === 'pdf') {
                                                if (onProgress) onProgress(`正在尝试转换图片PDF: ${file.name}...`)
                                                const blob = await fetchPdfBlob(file.downloadUrl)
                                                if (blob) {
                                                    const images = await convertPdfToImages(blob)
                                                    if (images.length > 0) {
                                                        visualContentCache.set(file.downloadUrl, {
                                                            filename: file.name,
                                                            images
                                                        })
                                                        line += `  [此文件为图片PDF，包含 ${images.length} 页图片，请查看附带的图片内容]`
                                                        if (onProgress) onProgress(`✅ 转换成功: ${file.name} (${images.length} 页)`)
                                                    } else {
                                                        line += `  (此文件内容过短或为空，无法提取文本)`
                                                    }
                                                } else {
                                                    line += `  (文件读取失败)`
                                                }
                                            } else {
                                                if (onProgress) onProgress(`⚠️ 内容过短或为空: ${file.name}`)
                                                line += `  (此文件内容过短或为空，无法提取文本)`
                                            }
                                        } catch (e) {
                                            line += `  (转换为图片失败: ${String(e)})`
                                        }

                                        // Cache this text result effectively (but we might have updated visual cache)
                                        if (!visualContentCache.has(file.downloadUrl)) {
                                            fileContentCache.set(file.downloadUrl, line)
                                        }
                                    }
                                } else {
                                    if (onProgress) onProgress(`✅ 读取成功: ${file.name} (${content.length} 字符)`)
                                    line += content
                                    fileContentCache.set(file.downloadUrl, content)
                                }
                            } catch (e) {
                                const errMsg = `读取异常: ${String(e)}`
                                if (onProgress) onProgress(`❌ ${errMsg}`)
                                line += `  (${errMsg})`
                            }
                        }
                        line += `\n  --- 文件内容结束 ---\n`
                    }
                }
            }
            parts.push(line)
        }
    }

    if (context.homeworks.length > 0) {
        parts.push('')
        parts.push('【作业列表】')
        for (const homework of context.homeworks) {
            let line = `- ${homework.title}`
            if (homework.deadline) {
                line += `（截止：${formatDeadline(homework.deadline)}）`
            }
            if (homework.requirement) {
                line += `：${truncateText(homework.requirement, 150)}`
            }
            parts.push(line)
        }
    }

    let result = parts.join('\n')

    if (result.trim() === '') {
        result = '暂无课程资料'
    }

    return result
}

function truncateText(text: string, maxLength: number): string {
    const cleaned = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    if (cleaned.length <= maxLength) {
        return cleaned
    }
    return cleaned.substring(0, maxLength) + '...'
}

function formatDeadline(isoTime: string): string {
    const date = new Date(isoTime)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}月${day}日 ${hours}:${minutes}`
}
