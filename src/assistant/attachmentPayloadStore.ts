export type AttachmentPayloadType = 'text' | 'image' | 'pdf_blob'

export interface AttachmentPayloadRecord {
  id: string
  type: AttachmentPayloadType
  data: string | string[] | Blob
  size: number
  createdAt: number
  lastAccessed: number
}

const DB_NAME = 'xzzdpro_assistant_payloads'
const DB_VERSION = 1
const STORE_NAME = 'payloads'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const request = fn(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.onabort = () => reject(tx.error)
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
  const payload: AttachmentPayloadRecord = {
    ...record,
    createdAt: record.createdAt || Date.now(),
    lastAccessed: Date.now()
  }
  await withStore('readwrite', (store) => store.put(payload))
}

export async function peekPayload(id: string): Promise<AttachmentPayloadRecord | null> {
  if (!id) return null
  try {
    const result = await withStore('readonly', (store) => store.get(id))
    return (result as AttachmentPayloadRecord) || null
  } catch {
    return null
  }
}

export async function getPayload(id: string): Promise<AttachmentPayloadRecord | null> {
  if (!id) return null
  const record = await peekPayload(id)
  if (!record) return null
  try {
    await withStore('readwrite', (store) => {
      const next = { ...record, lastAccessed: Date.now() }
      return store.put(next)
    })
  } catch {
    // Non-fatal: access time update failure shouldn't block payload usage.
  }
  return record
}

export async function deletePayload(id: string): Promise<void> {
  if (!id) return
  await withStore('readwrite', (store) => store.delete(id))
}

export async function getAllPayloads(): Promise<AttachmentPayloadRecord[]> {
  const result = await withStore('readonly', (store) => store.getAll())
  return Array.isArray(result) ? (result as AttachmentPayloadRecord[]) : []
}

export async function gcPayloads(limitBytes: number): Promise<{ removed: string[]; totalBytes: number }>{
  const all = await getAllPayloads()
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
