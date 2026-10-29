import { isValidImageDataUri } from "@/assistant/utils/data-uri-utils"
import { storage } from "@/lib/storage"

export const PAGE_BACKGROUND_KEY = "pageBackground"
// The image is kept apart so changing the tint or fade never rewrites it.
export const PAGE_BACKGROUND_IMAGE_KEY = "pageBackgroundImage"
const LEGACY_AVATAR_KEY = "userAvatar"

export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_IMAGE_EDGE = 2560
const MAX_STORED_IMAGE_BYTES = 4 * 1024 * 1024

/** Page tints as HSL channels for the light and dark themes; null keeps the theme's own background. */
export const PAGE_TINTS = [
  { id: "default", name: "默认", light: null, dark: null },
  { id: "mist", name: "雾蓝", light: "214 32% 94%", dark: "216 24% 9%" },
  { id: "mint", name: "薄荷", light: "152 22% 93%", dark: "160 16% 8%" },
  { id: "apricot", name: "暖杏", light: "32 40% 93%", dark: "28 14% 8%" },
  { id: "lavender", name: "薰衣草", light: "256 28% 95%", dark: "256 16% 9%" },
  { id: "blossom", name: "樱粉", light: "345 36% 95%", dark: "340 12% 9%" }
] as const

export type PageTintId = (typeof PAGE_TINTS)[number]["id"]

export interface PageBackgroundSettings {
  tint: PageTintId
  /** How strongly the image is washed toward the page color, 0–0.9. */
  fade: number
}

export const DEFAULT_PAGE_BACKGROUND: PageBackgroundSettings = {
  tint: "default",
  fade: 0.5
}

/**
 * Coerces a stored value into valid settings, falling back to defaults.
 * @param value Value read from storage.
 * @returns Settings with a known tint and a fade within range.
 */
export function normalizePageBackground(
  value: unknown
): PageBackgroundSettings {
  const raw = (value || {}) as Partial<PageBackgroundSettings>
  const tint = PAGE_TINTS.some((item) => item.id === raw.tint)
    ? (raw.tint as PageTintId)
    : DEFAULT_PAGE_BACKGROUND.tint
  const fade =
    typeof raw.fade === "number" && Number.isFinite(raw.fade)
      ? Math.min(0.9, Math.max(0, raw.fade))
      : DEFAULT_PAGE_BACKGROUND.fade
  return { tint, fade }
}

/**
 * Applies the tint and image to the page. CSS picks the light or dark tint
 * from the theme, so this does not need to rerun when the theme changes.
 * @param settings Tint and fade.
 * @param image Image as a data URI, or null for none.
 */
export function applyPageBackground(
  settings: PageBackgroundSettings,
  image: string | null
): void {
  const html = document.documentElement
  const tint = PAGE_TINTS.find((item) => item.id === settings.tint)
  if (tint?.light && tint.dark) {
    html.setAttribute("data-page-tint", tint.id)
    html.style.setProperty("--page-tint-light", tint.light)
    html.style.setProperty("--page-tint-dark", tint.dark)
  } else {
    html.removeAttribute("data-page-tint")
    html.style.removeProperty("--page-tint-light")
    html.style.removeProperty("--page-tint-dark")
  }

  // A data URI rather than a blob URL: blob URLs made in a content script
  // are not always loadable by page styles (Firefox).
  if (image) {
    html.setAttribute("data-page-image", "")
    html.style.setProperty("--page-image", `url("${image}")`)
    html.style.setProperty("--page-image-fade", String(settings.fade))
  } else {
    html.removeAttribute("data-page-image")
    html.style.removeProperty("--page-image")
    html.style.removeProperty("--page-image-fade")
  }
}

/**
 * Reads the saved background.
 * @returns Settings and the image data URI (null when none is saved).
 */
export async function loadPageBackground(): Promise<{
  settings: PageBackgroundSettings
  image: string | null
}> {
  const [settings, image] = await Promise.all([
    storage.get(PAGE_BACKGROUND_KEY),
    storage.get<string>(PAGE_BACKGROUND_IMAGE_KEY)
  ])
  return {
    settings: normalizePageBackground(settings),
    // Only well-formed base64 images: the value is placed in a CSS url("…").
    image:
      typeof image === "string" && isValidImageDataUri(image) ? image : null
  }
}

/** @param settings Tint and fade to save. */
export async function savePageBackground(
  settings: PageBackgroundSettings
): Promise<void> {
  await storage.set(PAGE_BACKGROUND_KEY, settings)
}

/** @param image Data URI to save, or null to remove the image. */
export async function savePageBackgroundImage(
  image: string | null
): Promise<void> {
  if (image) await storage.set(PAGE_BACKGROUND_IMAGE_KEY, image)
  else await storage.remove(PAGE_BACKGROUND_IMAGE_KEY)
}

/** Frees the space used by the avatar this feature replaced. */
export function removeLegacyAvatar(): void {
  storage.remove(LEGACY_AVATAR_KEY).catch(() => {})
}

function encodeCanvas(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("图片压缩失败"))
          return
        }
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error || new Error("读取图片失败"))
        reader.readAsDataURL(blob)
      },
      "image/jpeg",
      quality
    )
  })
}

/**
 * Shrinks an uploaded image to at most 2560 px on the long edge and encodes
 * it as JPEG, lowering the quality until it fits the storage budget.
 * @param file Image chosen by the user.
 * @returns JPEG data URI.
 * @throws With a message to show when the file is not a usable image.
 */
export async function prepareBackgroundImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件")
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("图片不能超过 20 MB")
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error("无法读取这张图片"))
      image.src = objectUrl
    })
    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE / Math.max(img.naturalWidth, img.naturalHeight)
    )
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("图片压缩失败")
    context.drawImage(img, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.85, 0.72, 0.6]) {
      const dataUri = await encodeCanvas(canvas, quality)
      if (dataUri.length * 0.75 <= MAX_STORED_IMAGE_BYTES) return dataUri
    }
    throw new Error("图片压缩后仍然过大，请换一张")
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
