import type { AttachmentPayloadType } from "@/assistant/attachment-payload-store"

export const PAYLOAD_INDEX_KEY = "xzzdpro_payload_index"

export interface PayloadIndexEntry {
  type: AttachmentPayloadType
  size: number
  createdAt: number
  lastAccessed: number
}

export type PayloadIndex = Record<string, PayloadIndexEntry>

export type PayloadIndexOp =
  | { op: "put"; id: string; entry: PayloadIndexEntry }
  | { op: "touch"; id: string; at: number }
  | { op: "delete"; ids: string[] }

type IndexStorage = Pick<chrome.storage.StorageArea, "get" | "set">

let queue: Promise<unknown> = Promise.resolve()

/**
 * Applies one change to the attachment payload index.
 *
 * The index is a single storage value shared by every tab. Only the
 * background script writes it, and changes run one at a time, so two tabs
 * saving attachments at once cannot overwrite each other's entries.
 * @param op Entry to add or replace, access time to refresh, or ids to remove.
 * @param storage Storage area holding the index; injectable for tests.
 */
export function applyPayloadIndexOp(
  op: PayloadIndexOp,
  storage: IndexStorage = chrome.storage.local
): Promise<void> {
  const run = queue.then(async () => {
    const result = await storage.get(PAYLOAD_INDEX_KEY)
    const index: PayloadIndex = result[PAYLOAD_INDEX_KEY] || {}
    if (op.op === "put") {
      index[op.id] = op.entry
    } else if (op.op === "touch") {
      if (index[op.id]) index[op.id].lastAccessed = op.at
    } else {
      for (const id of op.ids) delete index[id]
    }
    await storage.set({ [PAYLOAD_INDEX_KEY]: index })
  })
  queue = run.catch(() => undefined)
  return run
}

/**
 * Checks that a message body is a well-formed index change.
 * @param value Message body from a content script.
 * @returns True if it can be passed to applyPayloadIndexOp.
 */
export function isPayloadIndexOp(value: unknown): value is PayloadIndexOp {
  if (!value || typeof value !== "object") return false
  const op = value as Partial<Record<string, unknown>>
  if (op.op === "put") {
    return (
      typeof op.id === "string" && !!op.entry && typeof op.entry === "object"
    )
  }
  if (op.op === "touch") {
    return typeof op.id === "string" && typeof op.at === "number"
  }
  if (op.op === "delete") {
    return Array.isArray(op.ids) && op.ids.every((id) => typeof id === "string")
  }
  return false
}
