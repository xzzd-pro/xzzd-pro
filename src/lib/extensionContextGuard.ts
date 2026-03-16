const EXTENSION_CONTEXT_INVALIDATED_RE = /Extension context invalidated/i
const INSTALL_FLAG = "__xzzd_extension_context_guard_installed__"

function getErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message

  if (typeof value === "string") return value

  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message
    return typeof message === "string" ? message : ""
  }

  return ""
}

function isExtensionContextInvalidated(value: unknown): boolean {
  return EXTENSION_CONTEXT_INVALIDATED_RE.test(getErrorMessage(value))
}

export function installExtensionContextGuard(): void {
  if (typeof window === "undefined") return

  const guardedWindow = window as unknown as Record<string, unknown>
  if (guardedWindow[INSTALL_FLAG]) return
  guardedWindow[INSTALL_FLAG] = true

  window.addEventListener(
    "error",
    (event) => {
      if (!isExtensionContextInvalidated(event.error ?? event.message)) return

      event.preventDefault()
      event.stopImmediatePropagation()
    },
    true
  )

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (!isExtensionContextInvalidated(event.reason)) return

      event.preventDefault()
    },
    true
  )
}
