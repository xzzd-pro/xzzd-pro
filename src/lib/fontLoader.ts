// Plasmo resolves `url:` imports to a web-accessible extension URL.
// The WOFF2 subset is generated from src/assets/LXGWWenKaiScreen.ttf by
// `python scripts/subset-font.py`; rerun it if the source font changes.
// @ts-ignore
import fontUrl from "url:../assets/fonts/LXGWWenKaiScreen.woff2"

const FONT_FORMAT = "woff2"
const FONT_FAMILY = "LXGW WenKai Screen"
let registered = false

/**
 * Register the brand font from the extension package instead of inlining it
 * into every injected stylesheet. The face is only registered, not loaded:
 * the browser fetches it the first time an element uses the family, so pages
 * with beautification disabled never download it. Text renders in the
 * fallback font until it is ready (font-display: swap).
 */
export function loadBrandFont(): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") {
    return Promise.resolve()
  }
  // Content scripts are bundled separately, so also check the shared FontFaceSet.
  if (registered || hasBrandFace()) {
    registered = true
    return Promise.resolve()
  }

  const face = new FontFace(
    FONT_FAMILY,
    `url("${fontUrl}") format("${FONT_FORMAT}")`,
    {
      style: "normal",
      weight: "normal",
      display: "swap"
    }
  )
  document.fonts.add(face)
  registered = true
  return Promise.resolve()
}

function hasBrandFace(): boolean {
  for (const face of document.fonts) {
    if (face.family.replace(/["']/g, "") === FONT_FAMILY) return true
  }
  return false
}
