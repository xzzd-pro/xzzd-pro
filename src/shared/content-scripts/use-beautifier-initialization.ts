import { useEffect, useRef } from "react"

interface BeautifierInitializationOptions {
  pageName: string
  beautify: () => void | Promise<void>
  shouldSkip?: () => boolean
  enabled: boolean
  waitForDom?: boolean
}

const ROOT_SELECTOR = ".xzzdpro-root"

// Keep the in-flight operation across effect cleanup (including StrictMode).
// Theme changes must not restart an asynchronous page mount.
/**
 * Runs a page beautifier once when enabled, retrying until the extension root appears, and never restarting a mount that is in progress.
 * @param options Page name, beautifier, skip check, enabled flag and whether to wait for DOMContentLoaded.
 */
export function useBeautifierInitialization({
  pageName,
  beautify,
  shouldSkip,
  enabled,
  waitForDom = false
}: BeautifierInitializationOptions) {
  const pending = useRef<Promise<boolean> | null>(null)
  const attempted = useRef(false)
  const succeeded = useRef(false)

  useEffect(() => {
    if (!enabled || shouldSkip?.()) return

    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelDelay: (() => void) | undefined

    const initialize = async () => {
      for (let attempt = 0; attempt < 3 && !disposed; attempt++) {
        if (shouldSkip?.()) return

        if (!pending.current) {
          if (
            (!attempted.current || succeeded.current) &&
            document.querySelector(ROOT_SELECTOR)
          )
            return

          attempted.current = true
          // Invoke inside then so synchronous exceptions also reach catch.
          pending.current = Promise.resolve()
            .then(() => beautify())
            .then(() => {
              succeeded.current = Boolean(document.querySelector(ROOT_SELECTOR))
              return succeeded.current
            })
            .catch((error) => {
              succeeded.current = false
              console.error(`XZZDPRO: failed to beautify ${pageName}`, error)
              return false
            })
            .finally(() => {
              pending.current = null
            })
        }

        if (await pending.current) return
        if (disposed || attempt === 2) return

        await new Promise<void>((resolve) => {
          cancelDelay = resolve
          timer = setTimeout(resolve, 500 * (attempt + 1))
        })
      }
    }

    const onReady = () => {
      void initialize()
    }
    if (waitForDom && document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", onReady, { once: true })
    } else {
      onReady()
    }

    return () => {
      disposed = true
      document.removeEventListener("DOMContentLoaded", onReady)
      clearTimeout(timer)
      cancelDelay?.()
    }
  }, [beautify, enabled, pageName, shouldSkip, waitForDom])
}
