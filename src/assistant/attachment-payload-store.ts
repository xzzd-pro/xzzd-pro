import { sendToBackground } from "@plasmohq/messaging"

import type { PayloadIndex, PayloadIndexOp } from "../background/payload-index"
import { dataUriToBlob } from "./utils/data-uri-utils"

export type AttachmentPayloadType = "text" | "image" | "pdf_blob"

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
const RECORD_KEY_PREFIX = "xzzdpro_payload:"
const INDEX_KEY = "xzzdpro_payload_index"
const LEGACY_MIGRATED_KEY = "xzzdpro_payload_legacy_migrated"
const LEGACY_DELETED_KEY = "xzzdpro_payload_legacy_deleted"

const LEGACY_DB_NAME = "xzzdpro_assistant_payloads"
const LEGACY_STORE_NAME = "payloads"

interface StoredPayload {
  type: AttachmentPayloadType
  // Blobs are not storable in chrome.storage, so they are kept as data URIs.
  data: string | string[]
  blob?: boolean
}

const recordKey = (id: string) => `${RECORD_KEY_PREFIX}${id}`

/**
 * Sends an index change to the background script, the index's only writer.
 * @param op Change to apply.
 * @throws If the background script rejects or fails to apply the change.
 */
async function updateIndex(op: PayloadIndexOp): Promise<void> {
  const response = (await sendToBackground({
    name: "payload-index",
    body: op
  } as any)) as { ok?: boolean; error?: string } | undefined
  if (!response?.ok) {
    throw new Error(response?.error || "Payload index update failed")
  }
}

async function readIndex(): Promise<PayloadIndex> {
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
  const stored: StoredPayload =
    record.data instanceof Blob
      ? {
          type: record.type,
          data: await blobToDataUri(record.data),
          blob: true
        }
      : { type: record.type, data: record.data }
  await chrome.storage.local.set({ [recordKey(record.id)]: stored })
  await updateIndex({
    op: "put",
    id: record.id,
    entry: {
      type: record.type,
      size: record.size,
      createdAt: record.createdAt,
      lastAccessed: record.lastAccessed
    }
  })
}

let legacyMigration: Promise<void> | null = null

/**
 * Moves payloads that older versions cached in the page's IndexedDB into
 * extension storage, then deletes that database so the page origin no longer
 * holds them. The old database is deleted only after every record was copied;
 * if reading or any write fails, it is kept and the move is retried on the
 * next page load. Within one page, later calls share the same promise.
 */
function migrateLegacyPayloads(): Promise<void> {
  if (legacyMigration) return legacyMigration
  legacyMigration = (async () => {
    if (typeof indexedDB === "undefined") return
    const flags = await chrome.storage.local.get([
      LEGACY_MIGRATED_KEY,
      LEGACY_DELETED_KEY
    ])

    if (!flags[LEGACY_MIGRATED_KEY]) {
      let records: AttachmentPayloadRecord[]
      try {
        records = await readLegacyPayloads()
      } catch (error) {
        console.warn("Legacy payloads unreadable; will retry later", error)
        return
      }
      let failed = 0
      for (const record of records) {
        try {
          await writeRecord(record)
        } catch (error) {
          failed += 1
          console.warn("Failed to migrate payload", record.id, error)
        }
      }
      if (failed > 0) return
      await chrome.storage.local.set({ [LEGACY_MIGRATED_KEY]: true })
    }

    if (!flags[LEGACY_DELETED_KEY]) deleteLegacyDatabase()
  })().catch((error) => {
    console.warn("Legacy payload migration failed:", error)
  })
  return legacyMigration
}

// Deletion waits while tabs still running an old version keep the database
// open, so it is not awaited; the flag is set only once it actually succeeds.
function deleteLegacyDatabase(): void {
  const request = indexedDB.deleteDatabase(LEGACY_DB_NAME)
  request.onsuccess = () => {
    void chrome.storage.local.set({ [LEGACY_DELETED_KEY]: true })
  }
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
      const getAll = db
        .transaction(LEGACY_STORE_NAME, "readonly")
        .objectStore(LEGACY_STORE_NAME)
        .getAll()
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

/**
 * Creates a unique id for a stored attachment payload.
 * @param prefix Readable prefix for the id.
 * @returns An id like `payload_<timestamp>_<random>`.
 */
export function createPayloadRef(prefix: string = "payload"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Estimates how many bytes a payload occupies.
 * @param data Text, list of strings (e.g. image data URIs) or a Blob.
 * @returns Size in bytes; strings are measured as UTF-8.
 */
export function estimatePayloadBytes(
  data: AttachmentPayloadRecord["data"]
): number {
  if (data instanceof Blob) return data.size
  if (Array.isArray(data)) {
    return data.reduce((sum, item) => sum + estimatePayloadBytes(item), 0)
  }
  if (typeof data === "string") {
    return new TextEncoder().encode(data).length
  }
  return 0
}

/**
 * Saves a payload and marks it as just accessed.
 * @param record Payload to store; createdAt defaults to now.
 */
export async function putPayload(
  record: AttachmentPayloadRecord
): Promise<void> {
  await migrateLegacyPayloads()
  await writeRecord({
    ...record,
    createdAt: record.createdAt || Date.now(),
    lastAccessed: Date.now()
  })
}

/**
 * Reads a payload without updating its last-access time.
 * @param id Payload id.
 * @returns The payload, or null if it is missing or cannot be read.
 */
export async function peekPayload(
  id: string
): Promise<AttachmentPayloadRecord | null> {
  if (!id) return null
  try {
    await migrateLegacyPayloads()
    const key = recordKey(id)
    const [result, index] = await Promise.all([
      chrome.storage.local.get(key),
      readIndex()
    ])
    const stored = result[key] as StoredPayload | undefined
    if (!stored) return null
    const meta = index[id]
    return {
      id,
      type: stored.type,
      data:
        stored.blob && typeof stored.data === "string"
          ? dataUriToBlob(stored.data)
          : stored.data,
      size: meta?.size ?? estimatePayloadBytes(stored.data),
      createdAt: meta?.createdAt ?? 0,
      lastAccessed: meta?.lastAccessed ?? 0
    }
  } catch {
    return null
  }
}

/**
 * Reads a payload and refreshes its last-access time, so garbage collection keeps it longer.
 * @param id Payload id.
 * @returns The payload, or null if it is missing.
 */
export async function getPayload(
  id: string
): Promise<AttachmentPayloadRecord | null> {
  if (!id) return null
  const record = await peekPayload(id)
  if (!record) return null
  try {
    await updateIndex({ op: "touch", id, at: Date.now() })
  } catch {
    // Non-fatal: access time update failure shouldn't block payload usage.
  }
  return record
}

/**
 * Removes a payload and its index entry.
 * @param id Payload id; empty ids are ignored.
 */
export async function deletePayload(id: string): Promise<void> {
  if (!id) return
  await chrome.storage.local.remove(recordKey(id))
  await updateIndex({ op: "delete", ids: [id] })
}

/**
 * Deletes least recently used payloads until the total size fits the limit.
 * @param limitBytes Maximum total size to keep.
 * @returns Ids that were removed and the remaining total size in bytes.
 */
export async function gcPayloads(
  limitBytes: number
): Promise<{ removed: string[]; totalBytes: number }> {
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

  const sorted = [...all].sort(
    (a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0)
  )
  const removed: string[] = []
  for (const record of sorted) {
    if (total <= limitBytes) break
    removed.push(record.id)
    total -= record.size || 0
  }
  await chrome.storage.local.remove(removed.map(recordKey))
  await updateIndex({ op: "delete", ids: removed })

  return { removed, totalBytes: total }
}
