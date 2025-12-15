import { Storage } from '@plasmohq/storage'
import { SecureStorage } from '@plasmohq/storage/secure'
import type { AssistantSettings, ChatMessage, ChatSession } from './types'
import { STORAGE_KEYS, DEFAULT_PROVIDER, PROVIDER_DEFAULTS, MAX_HISTORY_MESSAGES } from './config'

const storage = new Storage({
    area: "local"
})
const secureStorage = new SecureStorage()

const SECURE_STORAGE_PASSWORD = 'xzzdpro_assistant_v1'

async function initSecureStorage(): Promise<void> {
    await secureStorage.setPassword(SECURE_STORAGE_PASSWORD)
}

export async function saveSettings(settings: AssistantSettings): Promise<void> {
    await initSecureStorage()
    await secureStorage.set(STORAGE_KEYS.settings, JSON.stringify(settings))
}

export async function loadSettings(): Promise<AssistantSettings> {
    await initSecureStorage()
    const data = await secureStorage.get(STORAGE_KEYS.settings)
    if (data) {
        return JSON.parse(data) as AssistantSettings
    }
    return {
        provider: DEFAULT_PROVIDER,
        configs: {
            [DEFAULT_PROVIDER]: {
                apiKey: '',
                ...PROVIDER_DEFAULTS[DEFAULT_PROVIDER]
            }
        }
    }
}

export async function saveChatHistory(courseId: string, session: ChatSession): Promise<void> {
    const key = `${STORAGE_KEYS.chatHistory}${courseId}`
    const trimmedSession: ChatSession = {
        ...session,
        messages: session.messages.slice(-MAX_HISTORY_MESSAGES),
        updatedAt: Date.now()
    }
    await storage.set(key, JSON.stringify(trimmedSession))
}

export async function loadChatHistory(courseId: string): Promise<ChatSession | null> {
    const key = `${STORAGE_KEYS.chatHistory}${courseId}`
    const data = await storage.get(key)
    if (data) {
        return JSON.parse(data) as ChatSession
    }
    return null
}

export async function clearChatHistory(courseId?: string): Promise<void> {
    if (courseId) {
        const key = `${STORAGE_KEYS.chatHistory}${courseId}`
        await storage.remove(key)
    } else {
        const allKeys = await storage.getAll()
        const chatKeys = Object.keys(allKeys).filter(k => k.startsWith(STORAGE_KEYS.chatHistory))
        for (const key of chatKeys) {
            await storage.remove(key)
        }
    }
}

export async function getAllChatSessions(): Promise<ChatSession[]> {
    const allData = await storage.getAll()
    const sessions: ChatSession[] = []
    for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(STORAGE_KEYS.chatHistory) && value) {
            sessions.push(JSON.parse(value as string) as ChatSession)
        }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export function createChatMessage(role: 'user' | 'assistant', content: string): ChatMessage {
    return {
        id: generateMessageId(),
        role,
        content,
        timestamp: Date.now()
    }
}
