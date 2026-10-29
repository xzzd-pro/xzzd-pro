import { dataUriToBlob } from './utils/dataUriUtils'

export type AttachmentPayloadType = 'text' | 'image' | 'pdf_blob'

export interface AttachmentPayloadRecord {
  id: string
  type: AttachmentPayloadType
  data: string | string[] | Blob
  size: number
  createdAt: number
  lastAccessed: number
}

// Payloads live in chrome.storage.local (extension origin). A content script's
// indexedDB belongs to the host page's origin, where page scripts could read it.
const RECORD_KEY_PREFIX = 'xzzdpro_payload:'
const INDEX_KEY = 'xzzdpro_payload_index'
const LEGACY_MIGRATED_KEY = 'xzzdpro_payload_legacy_migrated'

const LEGACY_DB_NAME = 'xzzdpro_assistant_payloads'
const LEGACY_STORE_NAME = 'payloads'

type PayloadMeta = Omit<AttachmentPayloadRecord, 'id' | 'data'>
type PayloadIndex = Record<string, PayloadMeta>

interface StoredPayload {
  type: AttachmentPayloadType
  // Blobs are not storable in chrome.storage, so they are kept as data URIs.
  data: string | string[]
  blob?: boolean
}

const recordKey = (id: string) => `${RECORD_KEY_PREFIX}${id}`

// Serialize index read-modify-write cycles within this context.
let indexQueue: Promise<unknown> = Promise.resolve()

function updateIndex<T>(fn: (index: PayloadIndex) => T): Promise<T> {
  const run = indexQueue.then(async () => {
    const result = await chrome.storage.local.get(INDEX_KEY)
    const index: PayloadIndex = result[INDEX_KEY] || {}
    const value = fn(index)
    await chrome.storage.local.set({ [INDEX_KEY]: index })
    return value
  })
  indexQueue = run.catch(() => undefined)
  return run
}

async function readIndex(): Promise<PayloadIndex> {
  await indexQueue
  const result = await chrome.storage.local.get(INDEX_KEY)
  return result[INDEX_KEY] || {}
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function writeRecord(record: AttachmentPayloadRecord): Promise<void> {
  const stored: StoredPayload = record.data instanceof Blob
    ? { type: record.type, data: await blobToDataUri(record.data), blob: true }
    : { type: record.type, data: record.data }
  await chrome.storage.local.set({ [recordKey(record.id)]: stored })
  await updateIndex((index) => {
    index[record.id] = {
      type: record.type,
      size: record.size,
      createdAt: record.createdAt,
      lastAccessed: record.lastAccessed
    }
  })
}

// One-time move of payloads cached by older versions in the page's IndexedDB,
// then drop that database so the page origin no longer holds them.
let legacyMigration: Promise<void> | null = null

function migrateLegacyPayloads(): Promise<void> {
  if (legacyMigration) return legacyMigration
  legacyMigration = (async () => {
    const flag = await chrome.storage.local.get(LEGACY_MIGRATED_KEY)
    if (flag[LEGACY_MIGRATED_KEY] || typeof indexedDB === 'undefined') return

    const records = await readLegacyPayloads().catch(() => [] as AttachmentPayloadRecord[])
    for (const record of records) {
      await writeRecord(record).catch((error) => console.warn('Failed to migrate payload', record.id, error))
    }
    indexedDB.deleteDatabase(LEGACY_DB_NAME)
    await chrome.storage.local.set({ [LEGACY_MIGRATED_KEY]: true })
  })().catch((error) => {
    console.warn('Legacy payload migration failed:', error)
  })
  return legacyMigration
}

function readLegacyPayloads(): Promise<AttachmentPayloadRecord[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.close()
        resolve([])
        return
      }
      const getAll = db.transaction(LEGACY_STORE_NAME, 'readonly').objectStore(LEGACY_STORE_NAME).getAll()
      getAll.onsuccess = () => {
        db.close()
        resolve((getAll.result as AttachmentPayloadRecord[]) || [])
      }
      getAll.onerror = () => {
        db.close()
        reject(getAll.error)
      }
    }
  })
}

export function createPayloadRef(prefix: string = 'payload'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function estimatePayloadBytes(data: AttachmentPayloadRecord['data']): number {
  if (data instanceof Blob) return data.size
  if (Array.isArray(data)) {
    return data.reduce((sum, item) => sum + estimatePayloadBytes(item), 0)
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data).length
  }
  return 0
}

export async function putPayload(record: AttachmentPayloadRecord): Promise<void> {
  await migrateLegacyPayloads()
  await writeRecord({
    ...record,
    createdAt: record.createdAt || Date.now(),
    lastAccessed: Date.now()
  })
}

export async function peekPayload(id: string): Promise<AttachmentPayloadRecord | null> {
  if (!id) return null
  try {
    await migrateLegacyPayloads()
    const key = recordKey(id)
    const [result, index] = await Promise.all([chrome.storage.local.get(key), readIndex()])
    const stored = result[key] as StoredPayload | undefined
    if (!stored) return null
    const meta = index[id]
    return {
      id,
      type: stored.type,
      data: stored.blob && typeof stored.data === 'string' ? dataUriToBlob(stored.data) : stored.data,
      size: meta?.size ?? estimatePayloadBytes(stored.data),
      createdAt: meta?.createdAt ?? 0,
      lastAccessed: meta?.lastAccessed ?? 0
    }
  } catch {
    return null
  }
}

export async function getPayload(id: string): Promise<AttachmentPayloadRecord | null> {
  if (!id) return null
  const record = await peekPayload(id)
  if (!record) return null
  try {
    await updateIndex((index) => {
      if (index[id]) index[id].lastAccessed = Date.now()
    })
  } catch {
    // Non-fatal: access time update failure shouldn't block payload usage.
  }
  return record
}

export async function deletePayload(id: string): Promise<void> {
  if (!id) return
  await chrome.storage.local.remove(recordKey(id))
  await updateIndex((index) => {
    delete index[id]
  })
}

export async function gcPayloads(limitBytes: number): Promise<{ removed: string[]; totalBytes: number }>{
  await migrateLegacyPayloads()
  const index = await readIndex()
  const all = Object.entries(index).map(([id, meta]) => ({ id, ...meta }))
  let total = 0
  for (const record of all) {
    total += record.size || 0
  }

  if (total <= limitBytes) {
    return { removed: [], totalBytes: total }
  }

  const sorted = [...all].sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0))
  const removed: string[] = []
  for (const record of sorted) {
    if (total <= limitBytes) break
    await deletePayload(record.id)
    removed.push(record.id)
    total -= record.size || 0
  }

  return { removed, totalBytes: total }
}
