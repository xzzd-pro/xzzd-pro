/**
 * Earlier versions wrote these keys through `new Storage()`, whose default
 * area is `sync` (8 KB per item). Everything now lives in `local`; copy the
 * old values once so upgrading users keep their theme, layout, avatar and
 * read state. Plasmo stores serialized strings in both areas, so raw values
 * can be copied as they are. The sync copies are left in place: sync is shared
 * across the user's devices, and a device that has not upgraded yet still
 * reads them.
 */
const LEGACY_SYNC_KEYS = [
  "theme",
  "indexPageLayout",
  "userAvatar",
  "xzzdpro_read_timestamps"
] as const

export async function migrateLegacySyncStorage(): Promise<void> {
  try {
    const legacy = await chrome.storage.sync.get([...LEGACY_SYNC_KEYS])
    const keys = Object.keys(legacy)
    if (keys.length === 0) return

    const current = await chrome.storage.local.get(keys)
    const toCopy: Record<string, unknown> = {}
    for (const key of keys) {
      if (current[key] === undefined) toCopy[key] = legacy[key]
    }
    if (Object.keys(toCopy).length > 0) {
      await chrome.storage.local.set(toCopy)
    }
  } catch (error) {
    console.warn("XZZDPRO: legacy storage migration failed", error)
  }
}
