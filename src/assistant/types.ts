import type { FlashcardData } from "./types/flashcard"

export type Provider =
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'openrouter'
    | 'siliconflow'
    | 'qwen'
    | 'deepseek'

export interface ProviderConfig {
    apiKey: string
    baseUrl?: string
    model: string
}

export interface AssistantSettings {
    provider: Provider
    configs: Partial<Record<Provider, ProviderConfig>>
}

export interface Attachment {
    type: 'image' | 'text' | 'pdf'
    content: string | string[]
    name: string
    originalData?: string  // Original file as base64 data URI (for recall)
}

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    attachments?: Attachment[]
    flashcards?: FlashcardData
}

export interface ChatSession {
    courseId: string
    courseName: string
    messages: ChatMessage[]
    updatedAt: number
}

export interface MaterialFile {
    id: number
    name: string
    size: number
    downloadUrl: string
}

export interface MaterialSummary {
    id: number
    title: string
    description?: string
    files?: MaterialFile[]
}

export interface HomeworkSummary {
    id: number
    title: string
    requirement?: string
    deadline?: string
}

export interface CourseContext {
    courseId: string
    courseName: string
    materials: MaterialSummary[]
    homeworks: HomeworkSummary[]
}

export interface CourseInfo {
    id: number
    name: string
    displayName: string
    instructors: string[]
}
