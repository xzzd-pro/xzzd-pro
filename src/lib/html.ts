import DOMPurify from "dompurify"

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}

/** Escape text before interpolating it into an HTML template string. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

/**
 * Sanitize HTML from untrusted sources (model output, teacher-authored rich
 * text) before assigning it to innerHTML. Scripts, event handlers and
 * javascript: URLs are removed; ordinary formatting is kept.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"]
  })
}

// Links opened from sanitized content must not get access to window.opener.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node instanceof HTMLAnchorElement && node.target === "_blank") {
    node.rel = "noopener noreferrer"
  }
})
