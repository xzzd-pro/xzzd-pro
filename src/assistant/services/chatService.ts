import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import type { MessageContentComplex } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { ChatMessage, CourseContext, Provider, ProviderConfig, Attachment } from '../types'
import { createChatModel } from '../providers'
import { buildSystemPrompt, getVisualContext } from './contextBuilder'
import { isValidImageDataUri, dataUriToBlob } from '../utils/dataUriUtils'
import { extractPdfText } from './fileService'
import { getPayload } from '../attachmentPayloadStore'

export interface StreamChatOptions {
    messages: ChatMessage[]
    context: CourseContext
    provider: Provider
    config: ProviderConfig
    onChunk: (chunk: string) => void
    onFirstChunk?: () => void
    onComplete?: (fullResponse: string) => void
    onError?: (error: Error) => void
    onProgress?: (msg: string) => void
    signal?: AbortSignal
}

export async function streamChat(options: StreamChatOptions): Promise<string> {
    const { messages, context, provider, config, onChunk, onFirstChunk, onComplete, onError, onProgress, signal } = options

    try {
        if (signal?.aborted) {
            throw createStreamAbortError()
        }

        const model = createChatModel(provider, config)
        const systemPrompt = await buildSystemPrompt(context, onProgress)
        const visualContext = getVisualContext(context)

        console.log('XZZDPRO: Visual Context Count:', visualContext.length)
        if (visualContext.length > 0) {
            console.log('XZZDPRO: First visual item images:', visualContext[0].images.length)
        }

        const { messages: langchainMessages, hasImageInputs } = await buildLangChainMessages(systemPrompt, messages, visualContext, { mode: 'full' })

        // Debug log to check identifying structure of messages (without dumping huge base64 strings)
        console.log('XZZDPRO: LangChain Messages Structure:',
            langchainMessages.map(m => ({
                type: m._getType(),
                contentLength: Array.isArray(m.content) ? m.content.length : m.content.length,
                contentTypes: Array.isArray(m.content) ? m.content.map((c: any) => c.type) : 'string',
                hasImages: Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url')
            }))
        )

        // --- API Call Debug Start ---
        const sanitizedConfig = { ...config, apiKey: '***' }
        console.info('Config:', JSON.stringify(sanitizedConfig, null, 2))
        // --- API Call Debug End ---

        let fullResponse = ''
        let hasFirstChunk = false
        let abortListener: (() => void) | null = null
        try {
            const stream = await model.stream(langchainMessages) as AsyncIterable<any>
            const streamIterator = stream[Symbol.asyncIterator] ? stream[Symbol.asyncIterator]() : null

            if (streamIterator && signal) {
                abortListener = () => {
                    void streamIterator.return?.()
                }
                signal.addEventListener('abort', abortListener, { once: true })
            }

            for await (const chunk of stream) {
                if (signal?.aborted) {
                    throw createStreamAbortError()
                }
                const content = extractChunkText(chunk.content)
                if (content) {
                    if (!hasFirstChunk) {
                        hasFirstChunk = true
                        onFirstChunk?.()
                    }
                    fullResponse += content
                    onChunk(content)
                }
            }
        } catch (streamError: any) {
            if (signal?.aborted || isStreamAbortError(streamError)) {
                throw createStreamAbortError()
            }
            const streamErrMsg = streamError instanceof Error ? streamError.message : String(streamError)
            const apiCode = extractApiErrorCode(streamErrMsg)

            // Some OpenAI-compatible gateways may fail on multimodal payloads with code 50507.
            // Retry once without visual course-image context to improve resilience.
            if (apiCode === 50507 && visualContext.length > 0 && fullResponse.length === 0) {
                onProgress?.('检测到模型网关错误(50507)，正在自动重试（不附带图片上下文）')
                const { messages: fallbackMessages } = await buildLangChainMessages(systemPrompt, messages, [], { mode: 'full' })
                const fallbackStream = await model.stream(fallbackMessages)
                for await (const chunk of fallbackStream) {
                    if (signal?.aborted) {
                        throw createStreamAbortError()
                    }
                    const content = extractChunkText(chunk.content)
                    if (content) {
                        if (!hasFirstChunk) {
                            hasFirstChunk = true
                            onFirstChunk?.()
                        }
                        fullResponse += content
                        onChunk(content)
                    }
                }
            } else if (shouldRetryTextOnly(apiCode, streamErrMsg) && hasImageInputs && fullResponse.length === 0) {
                onProgress?.('检测到图片输入不兼容，正在自动重试（文本优先模式）')
                const { messages: fallbackMessages } = await buildLangChainMessages(systemPrompt, messages, [], { mode: 'text_only' })
                const fallbackStream = await model.stream(fallbackMessages)
                for await (const chunk of fallbackStream) {
                    if (signal?.aborted) {
                        throw createStreamAbortError()
                    }
                    const content = extractChunkText(chunk.content)
                    if (content) {
                        if (!hasFirstChunk) {
                            hasFirstChunk = true
                            onFirstChunk?.()
                        }
                        fullResponse += content
                        onChunk(content)
                    }
                }
            } else {
                throw streamError
            }
        } finally {
            if (abortListener && signal) {
                signal.removeEventListener('abort', abortListener)
            }
        }

        console.info('XZZDPRO: API Response (Stream Complete):', fullResponse)
        onComplete?.(fullResponse)
        return fullResponse
    } catch (error: any) {
        let errMsg = error instanceof Error ? error.message : String(error);
        
        // Some real message
        if (error.cause) {
            const causeMsg = error.cause instanceof Error ? error.cause.message : String(error.cause);
            errMsg += `\n[Deep Cause]: ${causeMsg}`;
        }

        const err = new Error(errMsg);
        
        console.error('Chat Error details:', err.message);
        
        onError?.(err);
        throw err;
    }
}

function createStreamAbortError(): Error {
    return new Error('STREAM_ABORTED')
}

function isStreamAbortError(error: unknown): boolean {
    return error instanceof Error && error.message === 'STREAM_ABORTED'
}

function extractChunkText(content: unknown): string {
    if (!content) return ''

    if (typeof content === 'string') {
        return content
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (!part) return ''
                if (typeof part === 'string') return part
                if (typeof part === 'object') {
                    const maybeText = (part as any).text
                    if (typeof maybeText === 'string') return maybeText
                }
                return ''
            })
            .join('')
    }

    if (typeof content === 'object') {
        const maybeText = (content as any).text
        if (typeof maybeText === 'string') return maybeText
    }

    return ''
}

export async function generateResponse(
    messages: ChatMessage[],
    context: CourseContext,
    provider: Provider,
    config: ProviderConfig,
    onProgress?: (msg: string) => void
): Promise<string> {
    const model = createChatModel(provider, config)
    const systemPrompt = await buildSystemPrompt(context, onProgress)
    const visualContext = getVisualContext(context)
    const { messages: langchainMessages } = await buildLangChainMessages(systemPrompt, messages, visualContext, { mode: 'full' })

    const sanitizedConfig = { ...config, apiKey: '***' }
    console.info('Config:', JSON.stringify(sanitizedConfig, null, 2))

    const response = await model.invoke(langchainMessages)
    const content = typeof response.content === 'string' ? response.content : ''

    console.info('XZZDPRO: API Response (Invoke):', content)

    return content
}

interface VisualContent {
    filename: string
    images: string[]
}

type BuildMode = 'full' | 'text_only'

async function resolvePdfText(att: Attachment): Promise<string> {
    try {
        if (typeof att.originalData === 'string' && att.originalData.startsWith('data:')) {
            const blob = dataUriToBlob(att.originalData)
            return await extractPdfText(blob)
        }
        if (att.payloadRef) {
            const payload = await getPayload(att.payloadRef)
            if (payload?.type === 'pdf_blob' && payload.data instanceof Blob) {
                return await extractPdfText(payload.data)
            }
        }
    } catch (error) {
        console.warn('XZZDPRO: PDF 文本抽取失败', error)
    }
    return ''
}

function truncateAttachmentText(text: string, maxChars: number): string {
    if (!text) return ''
    if (text.length <= maxChars) return text
    return `${text.slice(0, maxChars)}...`
}

async function buildLangChainMessages(
    systemPrompt: string,
    messages: ChatMessage[],
    visualContext: VisualContent[],
    options: { mode: BuildMode }
): Promise<{ messages: Array<SystemMessage | HumanMessage | AIMessage>; hasImageInputs: boolean }> {
    const result: Array<SystemMessage | HumanMessage | AIMessage> = [
        new SystemMessage(systemPrompt)
    ]
    let hasImageInputs = false

    if (options.mode === 'full' && visualContext.length > 0) {
        const imageContent: MessageContentComplex[] = [
            { type: 'text', text: '以下是课程资料图片，请根据这些图片内容回答问题：' }
        ]

        for (const visual of visualContext) {
            imageContent.push({ type: 'text', text: `\n--- ${visual.filename} ---` })
            for (const imageDataUri of visual.images) {
                if (!isValidImageDataUri(imageDataUri)) {
                    continue
                }
                imageContent.push({
                    type: 'image_url',
                    image_url: { url: imageDataUri }
                })
                hasImageInputs = true
            }
        }

        if (imageContent.some((part: any) => part?.type === 'image_url')) {
            result.push(new HumanMessage({ content: imageContent as any }))
            result.push(new AIMessage('好的，我已经接收了课程资料的图片内容，请随时针对这些图片提问。'))
        }
    }

    for (const msg of messages) {
        if (msg.role === 'user') {
            const content: MessageContentComplex[] = []

            if (msg.content) {
                content.push({ type: 'text', text: msg.content })
            }

            if (msg.attachments && msg.attachments.length > 0) {
                for (const att of msg.attachments) {
                    if (options.mode === 'text_only') {
                        if (att.type === 'image') {
                            content.push({ type: 'text', text: `\n[附件图片: ${att.name}] (图片已省略)` })
                        } else if (att.type === 'pdf') {
                            const pdfText = truncateAttachmentText(await resolvePdfText(att), 4000)
                            if (pdfText) {
                                content.push({ type: 'text', text: `\n[附件PDF: ${att.name} 内容]:\n${pdfText}\n[文件内容结束]\n` })
                            } else {
                                content.push({ type: 'text', text: `\n[附件PDF: ${att.name}] (图片已省略，未能提取文本)` })
                            }
                        } else if (att.type === 'text') {
                            content.push({ type: 'text', text: `\n[附件文件 ${att.name} 内容]:\n${truncateAttachmentText(String(att.content || ''), 4000)}\n[文件内容结束]\n` })
                        }
                        continue
                    }

                    if (att.type === 'image') {
                        content.push({ type: 'text', text: `\n[附件图片: ${att.name}]` })
                        const imageUri = att.content as string
                        if (isValidImageDataUri(imageUri)) {
                            content.push({
                                type: 'image_url',
                                image_url: { url: imageUri }
                            })
                            hasImageInputs = true
                        } else {
                            content.push({ type: 'text', text: '(图片格式不兼容，已忽略)' })
                        }
                    } else if (att.type === 'pdf') {
                        content.push({ type: 'text', text: `\n[附件PDF: ${att.name}] (包含以下页面图片)` })
                        const images = Array.isArray(att.content) ? att.content : [att.content as string]
                        let validImageCount = 0
                        for (const img of images) {
                            if (!isValidImageDataUri(img)) continue
                            content.push({
                                type: 'image_url',
                                image_url: { url: img }
                            })
                            validImageCount += 1
                            hasImageInputs = true
                        }
                        if (validImageCount === 0) {
                            content.push({ type: 'text', text: '(PDF 图片格式不兼容，已忽略)' })
                        }
                    } else if (att.type === 'text') {
                        content.push({ type: 'text', text: `\n[附件文件 ${att.name} 内容]:\n${truncateAttachmentText(String(att.content || ''), 4000)}\n[文件内容结束]\n` })
                    }
                }
            }

            if (content.length > 0) {
                result.push(new HumanMessage({ content: content as any }))
            }
        } else {
            result.push(new AIMessage(msg.content))
        }
    }

    return { messages: result, hasImageInputs }
}

function shouldRetryTextOnly(apiCode: number | null, message: string): boolean {
    if (apiCode === 20015) return true
    const lower = message.toLowerCase()
    return lower.includes('image_url') && (lower.includes('not a valid image') || lower.includes('invalid image'))
}

// Helper function to extract API error message from JSON response
function extractApiErrorMessage(errorMessage: string): string | null {
    // First try to find and parse JSON part
    // API error format is usually: "API Error: 400 {\"error\":{...}}"
    const jsonStart = errorMessage.indexOf('{')
    if (jsonStart !== -1) {
        try {
            const jsonStr = errorMessage.substring(jsonStart)
            const parsed = JSON.parse(jsonStr)
            // Try multiple possible error structures
            if (parsed.error?.message) {
                return parsed.error.message
            }
            if (parsed.message) {
                return parsed.message
            }
            if (parsed.error) {
                return typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error)
            }
        } catch {
            // JSON parsing failed, fallback to regex
        }
    }

    // Fallback to regex matching
    const patterns = [
        /"message"\s*:\s*"([^"]+)"/,  // Match "message": "xxx"
        /"error"\s*:\s*"([^"]+)"/,     // Match "error": "xxx"
        /message['"]?:\s*['"]([^'"]+)['"]/,  // Match message: "xxx" or message: 'xxx'
    ]
    for (const pattern of patterns) {
        const match = errorMessage.match(pattern)
        if (match) return match[1]
    }
    return null
}

function extractApiErrorCode(errorMessage: string): number | null {
    const jsonStart = errorMessage.indexOf('{')
    if (jsonStart !== -1) {
        try {
            const parsed = JSON.parse(errorMessage.substring(jsonStart))
            const code = parsed?.code ?? parsed?.error?.code
            if (typeof code === 'number') return code
            if (typeof code === 'string' && /^\d+$/.test(code)) return Number(code)
        } catch {
            // Ignore parse failures and continue regex fallback.
        }
    }

    const codeMatch = errorMessage.match(/"code"\s*:\s*(\d+)/)
    if (codeMatch) return Number(codeMatch[1])
    return null
}

export function formatErrorMessage(error: Error): string {
    const lowerMessage = error.message.toLowerCase()
    const originalError = error.message

    // Try to extract detailed error message from API response
    const apiErrorDetail = extractApiErrorMessage(error.message)
    const apiErrorCode = extractApiErrorCode(error.message)

    let simplifiedMessage = ''

    if (apiErrorCode === 20015 || lowerMessage.includes('20015') || (lowerMessage.includes('image_url') && lowerMessage.includes('not a valid image'))) {
        simplifiedMessage = '图片输入不兼容 (20015)。已自动尝试文本模式，但仍失败。请尝试移除图片/缩小文件或更换模型。'
    } else if (apiErrorCode === 50507 || lowerMessage.includes('50507')) {
        simplifiedMessage = '模型服务端处理失败 (50507)。通常是服务端不稳定，或请求过大/含多模态内容导致。请重试或切换模型。'
    } else if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized') || lowerMessage.includes('invalid api key')) {
        simplifiedMessage = 'API Key 无效，请检查设置中的 API Key 是否正确'
    } else if (lowerMessage.includes('429') || lowerMessage.includes('rate limit')) {
        simplifiedMessage = '请求过于频繁，请稍后再试'
    } else if (lowerMessage.includes('timeout') || lowerMessage.includes('network')) {
        simplifiedMessage = '网络连接失败，请检查网络后重试'
    } else if (lowerMessage.includes('model') && lowerMessage.includes('not found')) {
        simplifiedMessage = '模型不可用，请在设置中选择其他模型'
    } else if (lowerMessage.includes('400') || lowerMessage.includes('bad request')) {
        const advice = [
            '请排查以下几点：',
            '1. 模型名称是否正确（如：gpt-4, gpt-4-vision 等）',
            '2. Base URL 是否正确配置',
            '3. API Key 是否过期或被撤销',
            '4. 是否在设置中正确保存了所有配置',
            '5. 可能出现文件选取过多或单次请求内容过大，详见原始错误详情'
        ].join('\n')
        simplifiedMessage = `请求格式错误 (400)\n${advice}`
    } else if (lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
        simplifiedMessage = '禁止访问 (403)：请检查 API Key 是否有权使用此模型'
    } else if (lowerMessage.includes('500') || lowerMessage.includes('server error')) {
        simplifiedMessage = 'AI 服务器出错，请稍后重试'
    } else {
        simplifiedMessage = `请求失败：${error.message}`
    }

    // Add API detailed error info if available and not already included
    if (apiErrorDetail && !lowerMessage.includes(apiErrorDetail.toLowerCase())) {
        simplifiedMessage += `\n详细原因：${apiErrorDetail}`
    }

    // Return simplified message + original error details
    return `${simplifiedMessage}\n\n原始错误详情：\n${originalError}`
}
