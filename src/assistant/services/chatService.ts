import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import type { MessageContentComplex } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { ChatMessage, CourseContext, Provider, ProviderConfig } from '../types'
import { createChatModel } from '../providers'
import { buildSystemPrompt, getVisualContext } from './contextBuilder'

export interface StreamChatOptions {
    messages: ChatMessage[]
    context: CourseContext
    provider: Provider
    config: ProviderConfig
    onChunk: (chunk: string) => void
    onComplete?: (fullResponse: string) => void
    onError?: (error: Error) => void
    onProgress?: (msg: string) => void
}

export async function streamChat(options: StreamChatOptions): Promise<string> {
    const { messages, context, provider, config, onChunk, onComplete, onError, onProgress } = options

    try {
        const model = createChatModel(provider, config)
        const systemPrompt = await buildSystemPrompt(context, onProgress)
        const visualContext = getVisualContext()

        console.log('XZZDPRO: Visual Context Count:', visualContext.length)
        if (visualContext.length > 0) {
            console.log('XZZDPRO: First visual item images:', visualContext[0].images.length)
        }

        const langchainMessages = convertToLangChainMessages(systemPrompt, messages, visualContext)

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
        const stream = await model.stream(langchainMessages)

        for await (const chunk of stream) {
            const content = typeof chunk.content === 'string' ? chunk.content : ''
            if (content) {
                fullResponse += content
                onChunk(content)
            }
        }

        console.info('XZZDPRO: API Response (Stream Complete):', fullResponse)
        onComplete?.(fullResponse)
        return fullResponse
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        onError?.(err)
        throw err
    }
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
    const visualContext = getVisualContext()
    const langchainMessages = convertToLangChainMessages(systemPrompt, messages, visualContext)

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

function convertToLangChainMessages(
    systemPrompt: string,
    messages: ChatMessage[],
    visualContext: VisualContent[]
): Array<SystemMessage | HumanMessage | AIMessage> {
    const result: Array<SystemMessage | HumanMessage | AIMessage> = [
        new SystemMessage(systemPrompt)
    ]

    // If we have visual context (images from image-only PDFs), inject them
    // We add a special HumanMessage containing the images before the conversation
    if (visualContext.length > 0) {
        const imageContent: MessageContentComplex[] = [
            { type: 'text', text: '以下是课程资料图片，请根据这些图片内容回答问题：' }
        ]

        for (const visual of visualContext) {
            // Add filename as text label
            imageContent.push({ type: 'text', text: `\n--- ${visual.filename} ---` })
            // Add each page as an image
            for (const imageDataUri of visual.images) {
                imageContent.push({
                    type: 'image_url',
                    image_url: { url: imageDataUri }
                })
            }
        }

        result.push(new HumanMessage({ content: imageContent as any }))

        // Add a dummy AI acknowledgement to ensure valid User -> Assistant -> User alternation
        // Many OpenAI-compatible providers (like Qwen, DeepSeek) fail if there are consecutive User messages
        result.push(new AIMessage('好的，我已经接收了课程资料的图片内容，请随时针对这些图片提问。'))
    }

    for (const msg of messages) {
        if (msg.role === 'user') {
            const content: MessageContentComplex[] = []

            // Add main text content
            if (msg.content) {
                content.push({ type: 'text', text: msg.content })
            }

            // Handle attachments
            if (msg.attachments && msg.attachments.length > 0) {
                for (const att of msg.attachments) {
                    if (att.type === 'image') {
                        content.push({ type: 'text', text: `\n[附件图片: ${att.name}]` })
                        content.push({
                            type: 'image_url',
                            image_url: { url: att.content as string }
                        })
                    } else if (att.type === 'pdf') {
                        content.push({ type: 'text', text: `\n[附件PDF: ${att.name}] (包含以下页面图片)` })
                        const images = Array.isArray(att.content) ? att.content : [att.content as string]
                        for (const img of images) {
                            content.push({
                                type: 'image_url',
                                image_url: { url: img }
                            })
                        }
                    } else if (att.type === 'text') {
                        content.push({ type: 'text', text: `\n[附件文件 ${att.name} 内容]:\n${att.content}\n[文件内容结束]\n` })
                    }
                }
            }

            // If we have mixed content (images + text), use complex format
            // If only text (including text attachments), we could simplify, but complex is safe for HumanMessage
            if (content.length > 0) {
                result.push(new HumanMessage({ content: content as any }))
            }
        } else {
            result.push(new AIMessage(msg.content))
        }
    }

    return result
}

export function formatErrorMessage(error: Error): string {
    const message = error.message.toLowerCase()

    if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid api key')) {
        return 'API Key 无效，请检查设置中的 API Key 是否正确'
    }

    if (message.includes('429') || message.includes('rate limit')) {
        return '请求过于频繁，请稍后再试'
    }

    if (message.includes('timeout') || message.includes('network')) {
        return '网络连接失败，请检查网络后重试'
    }

    if (message.includes('model') && message.includes('not found')) {
        return '模型不可用，请在设置中选择其他模型'
    }

    return `请求失败：${error.message}`
}
