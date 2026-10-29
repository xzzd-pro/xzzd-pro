/** One live registration per layout control, including across page remounts. */
interface Binding {
  owner: HTMLElement
  signal: AbortSignal
  dispose: () => void
  onCleanup: (cleanup: () => void) => void
}

const bindings = new Map<string, Binding>()
let observer: MutationObserver | undefined

/**
 * Registers a layout control (such as the sidebar toggle) so its listeners are removed when its element leaves the page or is bound again.
 * @param key Name of the control.
 * @param owner Element the listeners belong to.
 * @returns A binding with an abort signal and cleanup hook, or null if this element is already bound.
 */
export function bindLayoutControl(
  key: string,
  owner: HTMLElement
): Binding | null {
  const previous = bindings.get(key)
  if (previous?.owner === owner && !previous.signal.aborted) return null
  previous?.dispose()

  const controller = new AbortController()
  const cleanups: Array<() => void> = []
  const binding: Binding = {
    owner,
    signal: controller.signal,
    onCleanup(cleanup) {
      if (controller.signal.aborted) cleanup()
      else cleanups.push(cleanup)
    },
    dispose() {
      if (controller.signal.aborted) return
      controller.abort()
      bindings.delete(key)
      for (const cleanup of cleanups.splice(0)) {
        try {
          cleanup()
        } catch (error) {
          console.error("XZZDPRO: layout cleanup failed", error)
        }
      }
      if (!bindings.size) {
        observer?.disconnect()
        observer = undefined
      }
    }
  }
  bindings.set(key, binding)

  if (!observer) {
    observer = new MutationObserver(() => {
      for (const current of bindings.values()) {
        if (!current.owner.isConnected) current.dispose()
      }
    })
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    })
  }
  return binding
}

window.addEventListener("pagehide", (event) => {
  // A page restored from the back/forward cache keeps its live controls.
  if (!event.persisted) {
    for (const binding of bindings.values()) binding.dispose()
  }
})
