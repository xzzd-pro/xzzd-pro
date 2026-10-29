import type { Storage } from "@plasmohq/storage"

export type XzzdTheme = "light" | "dark"

/**
 * @param theme Stored theme value.
 * @returns "dark" if the value is "dark", otherwise "light".
 */
export function normalizeTheme(theme: unknown): XzzdTheme {
  return theme === "dark" ? "dark" : "light"
}

/**
 * @returns The theme matching the system color scheme.
 */
export function getFallbackTheme(): XzzdTheme {
  try {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  } catch {
    return "light"
  }
}

/**
 * Applies a theme to the page: data-theme attributes, the dark class and color-scheme.
 * @param theme Theme to apply.
 */
export function applyThemeToDocument(theme: XzzdTheme) {
  const html = document.documentElement
  html.setAttribute("data-theme", theme)
  html.classList.toggle("dark", theme === "dark")
  html.style.colorScheme = theme

  // Some styles are scoped to `.xzzdpro[data-theme=...]`
  document.body?.setAttribute("data-theme", theme)
  document
    .querySelectorAll<HTMLElement>(".xzzdpro")
    .forEach((el) => el.setAttribute("data-theme", theme))
}

/**
 * Apply an immediate fallback theme (sync) and then update from extension storage (async).
 * This is mainly to avoid a light flash before the stored theme is loaded.
 */
export function bootstrapStoredTheme(storage: Storage) {
  const fallback = getFallbackTheme()
  applyThemeToDocument(fallback)

  storage
    .get("theme")
    .then((t) => applyThemeToDocument(normalizeTheme(t ?? fallback)))
    .catch(() => {
      // Ignore - fallback is already applied.
    })
}
