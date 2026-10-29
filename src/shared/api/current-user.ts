import { storage } from "@/lib/storage"

import { findCurrentUserId } from "./find-current-user"
import { LoadError } from "./load-error"
import {
  createMyCoursesPayload,
  fetchMyCoursesResponse
} from "./my-courses-api"

const USER_ID_KEY = "xzzdpro_current_user_id"
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

interface CachedUserId {
  id: string
  /** Name shown by the course site when the id was found, if any. */
  name?: string
  savedAt: number
}

// Read before page beautifiers replace the site's header, which shows the
// signed-in user's name. Used to notice a different account on this browser.
const pageUserName =
  typeof document === "undefined"
    ? ""
    : document.querySelector("#userCurrentName")?.textContent?.trim() || ""

let pendingLookup: Promise<string | null> | null = null

function isUsableCache(value: unknown, now: number): value is CachedUserId {
  if (!value || typeof value !== "object") return false
  const cached = value as Partial<CachedUserId>
  return (
    typeof cached.id === "string" &&
    !!cached.id &&
    typeof cached.savedAt === "number" &&
    now - cached.savedAt >= 0 &&
    now - cached.savedAt < MAX_AGE_MS &&
    // A different signed-in name means the cached id belongs to someone else.
    !(pageUserName && cached.name && cached.name !== pageUserName)
  )
}

async function lookUpUserId(): Promise<string | null> {
  const response = await fetchMyCoursesResponse(createMyCoursesPayload())
  if (!response.ok) throw new LoadError("课程列表请求失败", response.status)
  const data = await response.json()
  if (!Array.isArray(data.courses) || data.courses.length === 0) {
    throw new LoadError("没有找到任何课程，无法确定当前用户。")
  }
  const id = await findCurrentUserId(data.courses)
  if (id) {
    const entry: CachedUserId = {
      id,
      name: pageUserName || undefined,
      savedAt: Date.now()
    }
    await storage
      .set(USER_ID_KEY, entry)
      .catch((error) => console.warn("XZZDPRO: 保存用户ID失败", error))
  }
  return id
}

/**
 * Returns the signed-in user's id, which several course-site APIs need.
 *
 * The id is cached in extension storage for 30 days, so only the first page
 * pays for the lookup (one course list request plus a few activity-read
 * requests). The cache is skipped when the site shows a different user name,
 * and callers should pass `refresh` after the site rejects a cached id.
 * Concurrent calls in one page share a single lookup.
 * @param options Set refresh to ignore the cache.
 * @returns The user id, or null if no course reveals it.
 * @throws LoadError if the course list cannot be loaded or is empty.
 */
export async function getCurrentUserId(
  options: { refresh?: boolean } = {}
): Promise<string | null> {
  if (!options.refresh) {
    const cached = await storage
      .get<unknown>(USER_ID_KEY)
      .catch(() => undefined)
    if (isUsableCache(cached, Date.now())) return cached.id
    if (pendingLookup) return pendingLookup
  }
  const lookup = lookUpUserId().finally(() => {
    if (pendingLookup === lookup) pendingLookup = null
  })
  pendingLookup = lookup
  return lookup
}
