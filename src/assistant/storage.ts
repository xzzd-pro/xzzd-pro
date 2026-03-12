import { Storage } from '@plasmohq/storage'
import { SecureStorage } from '@plasmohq/storage/secure'
import type { AssistantSettings, ChatMessage, ChatSession, AssistantUploadHistoryItem, Attachment } from './types'
import { STORAGE_KEYS, DEFAULT_PROVIDER, PROVIDER_DEFAULTS, MAX_HISTORY_MESSAGES } from './config'
import { createPayloadRef, deletePayload, estimatePayloadBytes, gcPayloads, peekPayload, putPayload } from './attachmentPayloadStore'
import { dataUriToBlob } from './utils/dataUriUtils'
import { hashArrayBuffer, hashString } from './utils/hashUtils'

const storage = new Storage({
    area: "local"
})
const secureStorage = new SecureStorage()

const SECURE_STORAGE_PASSWORD = 'xzzdpro_assistant_v1'

export const UPLOAD_HISTORY_INDEX_BYTE_LIMIT = 400 * 1024
export const UPLOAD_PAYLOAD_TOTAL_BYTE_LIMIT = 80 * 1024 * 1024
export const UPLOAD_PAYLOAD_SINGLE_BYTE_LIMIT = 15 * 1024 * 1024

export function normalizeHistoryFileName(name: string): string {
    return (name || '').trim().toLowerCase()
}

export function buildUploadHistoryKey(courseId: string, name: string, size: number, fingerprint: string): string {
    return [
        courseId,
        normalizeHistoryFileName(name),
        String(size),
        fingerprint || 'unknown'
    ].join('::')
}

function dedupeUploadHistoryItems(items: AssistantUploadHistoryItem[]): AssistantUploadHistoryItem[] {
    const deduped = new Map<string, AssistantUploadHistoryItem>()
    for (const item of items) {
        const key = buildUploadHistoryKey(item.courseId, item.name, item.size, item.fingerprint)
        const existing = deduped.get(key)
        if (!existing) {
            deduped.set(key, item)
            continue
        }

        const statusCandidates = [existing.status, item.status].filter(Boolean) as Array<NonNullable<AssistantUploadHistoryItem['status']>>
        let mergedStatus: AssistantUploadHistoryItem['status'] | undefined
        if (statusCandidates.includes('ready')) {
            mergedStatus = 'ready'
        } else if (statusCandidates.includes('session_only')) {
            mergedStatus = 'session_only'
        } else if (statusCandidates.includes('missing')) {
            mergedStatus = 'missing'
        }

        const merged: AssistantUploadHistoryItem = {
            ...existing,
            ...item,
            createdAt: Math.min(existing.createdAt || item.createdAt, item.createdAt || existing.createdAt),
            updatedAt: Math.max(existing.updatedAt || 0, item.updatedAt || 0),
            payloadRef: existing.payloadRef || item.payloadRef,
            fingerprint: existing.fingerprint || item.fingerprint,
            mimeType: item.mimeType || existing.mimeType,
            status: mergedStatus || item.status || existing.status
        }

        deduped.set(key, merged)
    }
    return Array.from(deduped.values()).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
}

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

function getUploadHistoryKey(courseId: string): string {
    return `${STORAGE_KEYS.uploadHistory}${courseId}`
}

function estimateHistoryIndexBytes(items: AssistantUploadHistoryItem[]): number {
    return new TextEncoder().encode(JSON.stringify(items)).length
}

function normalizeHistoryItem(raw: any): AssistantUploadHistoryItem | null {
    if (!raw) return null
    if (typeof raw.id !== 'string' || typeof raw.courseId !== 'string') return null
    if (typeof raw.name !== 'string' || typeof raw.size !== 'number') return null
    if (raw.sourceType !== 'assistant_upload') return null

    const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now()
    const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : createdAt

    return {
        id: raw.id,
        courseId: raw.courseId,
        name: raw.name,
        size: raw.size,
        mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : '',
        sourceType: 'assistant_upload',
        createdAt,
        updatedAt,
        payloadRef: typeof raw.payloadRef === 'string' ? raw.payloadRef : '',
        fingerprint: typeof raw.fingerprint === 'string' ? raw.fingerprint : '',
        status: raw.status
    }
}

async function fingerprintFromAttachment(att: Attachment): Promise<string> {
    if (att.type === 'pdf') {
        if (typeof att.originalData === 'string' && att.originalData.startsWith('data:')) {
            const blob = dataUriToBlob(att.originalData)
            return hashArrayBuffer(await blob.arrayBuffer())
        }
        if (Array.isArray(att.content)) {
            return hashString(att.content.join('|'))
        }
    }
    if (att.type === 'image') {
        const content = String(att.content || '')
        if (content.startsWith('data:')) {
            const blob = dataUriToBlob(content)
            return hashArrayBuffer(await blob.arrayBuffer())
        }
        return hashString(content)
    }
    if (att.type === 'text') {
        return hashString(String(att.content || ''))
    }
    return hashString(JSON.stringify(att))
}

async function migrateLegacyHistoryItem(raw: any): Promise<AssistantUploadHistoryItem | null> {
    const att = raw?.attachment as Attachment | undefined
    if (!att) return null

    const id = typeof raw.id === 'string' ? raw.id : createPayloadRef('upl')
    const courseId = typeof raw.courseId === 'string' ? raw.courseId : ''
    if (!courseId) return null

    const name = typeof raw.name === 'string' ? raw.name : att.name || '未命名文件'
    const size = typeof raw.size === 'number' ? raw.size : 0
    const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now()
    const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : createdAt

    const fingerprint = await fingerprintFromAttachment(att)
    const payloadRef = createPayloadRef('upl')

    let payloadType: 'text' | 'image' | 'pdf_blob' = 'text'
    let payloadData: string | string[] | Blob | null = null

    if (att.type === 'pdf') {
        if (typeof att.originalData === 'string' && att.originalData.startsWith('data:')) {
            payloadType = 'pdf_blob'
            payloadData = dataUriToBlob(att.originalData)
        } else if (Array.isArray(att.content)) {
            payloadType = 'image'
            payloadData = [...att.content]
        }
    } else if (att.type === 'image') {
        payloadType = 'image'
        payloadData = String(att.content || '')
    } else if (att.type === 'text') {
        payloadType = 'text'
        payloadData = String(att.content || '')
    }

    let status: AssistantUploadHistoryItem['status'] = 'ready'
    let payloadRefToSave = payloadRef

    if (!payloadData) {
        status = 'missing'
        payloadRefToSave = ''
    } else {
        const payloadSize = estimatePayloadBytes(payloadData)
        if (payloadSize > UPLOAD_PAYLOAD_SINGLE_BYTE_LIMIT) {
            status = 'missing'
            payloadRefToSave = ''
        } else {
            try {
                await putPayload({
                    id: payloadRef,
                    type: payloadType,
                    data: payloadData,
                    size: payloadSize,
                    createdAt,
                    lastAccessed: Date.now()
                })
            } catch (error) {
                console.warn('XZZDPRO: 迁移历史附件失败', error)
                status = 'missing'
                payloadRefToSave = ''
            }
        }
    }

    const mimeType = typeof raw.mimeType === 'string'
        ? raw.mimeType
        : att.type === 'pdf'
            ? 'application/pdf'
            : att.type === 'image'
                ? 'image/png'
                : 'text/plain'

    return {
        id,
        courseId,
        name,
        size,
        mimeType,
        sourceType: 'assistant_upload',
        createdAt,
        updatedAt,
        payloadRef: payloadRefToSave,
        fingerprint,
        status
    }
}

async function refreshHistoryStatus(items: AssistantUploadHistoryItem[]): Promise<AssistantUploadHistoryItem[]> {
    const results: AssistantUploadHistoryItem[] = []
    for (const item of items) {
        if (!item.payloadRef) {
            if (item.status === 'session_only') {
                results.push({ ...item, status: 'session_only' })
            } else {
                results.push({ ...item, status: 'missing' })
            }
            continue
        }
        const payload = await peekPayload(item.payloadRef)
        results.push({ ...item, status: payload ? 'ready' : 'missing' })
    }
    return results
}

async function pruneHistoryIndex(courseId: string, items: AssistantUploadHistoryItem[]): Promise<AssistantUploadHistoryItem[]> {
    let next = [...items]
    let indexBytes = estimateHistoryIndexBytes(next)
    if (indexBytes <= UPLOAD_HISTORY_INDEX_BYTE_LIMIT) return next

    const sorted = [...next].sort((a, b) => (a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt))
    const removedPayloads: string[] = []

    while (indexBytes > UPLOAD_HISTORY_INDEX_BYTE_LIMIT && sorted.length > 0) {
        const removed = sorted.shift()
        if (!removed) break
        next = next.filter(item => item.id !== removed.id)
        if (removed.payloadRef) removedPayloads.push(removed.payloadRef)
        indexBytes = estimateHistoryIndexBytes(next)
    }

    for (const payloadRef of removedPayloads) {
        try {
            await deletePayload(payloadRef)
        } catch (error) {
            console.warn('XZZDPRO: 删除历史附件失败', error)
        }
    }

    return next
}

async function safeSetHistory(courseId: string, items: AssistantUploadHistoryItem[]): Promise<void> {
    const key = getUploadHistoryKey(courseId)
    try {
        await storage.set(key, JSON.stringify(items))
    } catch (error) {
        console.warn('XZZDPRO: 保存上传历史失败', error)
    }
}

export async function getAssistantUploadHistory(courseId: string): Promise<AssistantUploadHistoryItem[]> {
    const key = getUploadHistoryKey(courseId)
    const data = await storage.get(key)
    if (!data) return []

    try {
        const parsed = JSON.parse(data as string)
        if (!Array.isArray(parsed)) return []

        const migrated: AssistantUploadHistoryItem[] = []
        let changed = false

        for (const raw of parsed) {
            if (raw?.attachment) {
                const migratedItem = await migrateLegacyHistoryItem(raw)
                if (migratedItem) {
                    migrated.push(migratedItem)
                }
                changed = true
                continue
            }

            const normalized = normalizeHistoryItem(raw)
            if (normalized) {
                migrated.push(normalized)
            } else {
                changed = true
            }
        }

        let next = dedupeUploadHistoryItems(migrated)
        next = await refreshHistoryStatus(next)

        if (next.length > 0) {
            const indexBytes = estimateHistoryIndexBytes(next)
            if (indexBytes > UPLOAD_HISTORY_INDEX_BYTE_LIMIT) {
                next = await pruneHistoryIndex(courseId, next)
                changed = true
            }
        }

        if (changed) {
            await safeSetHistory(courseId, next)
        }

        if (next.length > 0) {
            const indexBytes = estimateHistoryIndexBytes(next)
            console.debug('XZZDPRO: 历史索引大小', { courseId, bytes: indexBytes, count: next.length })
        }

        return next
    } catch (error) {
        console.warn('XZZDPRO: 读取上传历史失败', error)
        return []
    }
}

export async function saveAssistantUploadHistory(courseId: string, items: AssistantUploadHistoryItem[]): Promise<void> {
    const deduped = dedupeUploadHistoryItems(items)
    const pruned = await pruneHistoryIndex(courseId, deduped)
    await safeSetHistory(courseId, pruned)
}

export async function appendAssistantUploadHistory(courseId: string, items: AssistantUploadHistoryItem[]): Promise<void> {
    if (!courseId || items.length === 0) return
    const current = await getAssistantUploadHistory(courseId)
    const now = Date.now()
    const incoming = items.map(item => ({
        ...item,
        updatedAt: item.updatedAt || now
    }))
    const merged = dedupeUploadHistoryItems([...incoming, ...current])
    await saveAssistantUploadHistory(courseId, merged)

    try {
        await gcPayloads(UPLOAD_PAYLOAD_TOTAL_BYTE_LIMIT)
    } catch (error) {
        console.warn('XZZDPRO: 清理附件缓存失败', error)
    }
}

export async function deleteAssistantUploadHistoryItems(courseId: string, ids: string[]): Promise<void> {
    if (!courseId || ids.length === 0) return
    const idSet = new Set(ids)
    const current = await getAssistantUploadHistory(courseId)
    const payloadRefs = current.filter(item => idSet.has(item.id)).map(item => item.payloadRef).filter(Boolean)
    const next = current.filter(item => !idSet.has(item.id))
    await saveAssistantUploadHistory(courseId, next)

    for (const payloadRef of payloadRefs) {
        try {
            await deletePayload(payloadRef)
        } catch (error) {
            console.warn('XZZDPRO: 删除附件失败', error)
        }
    }
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
