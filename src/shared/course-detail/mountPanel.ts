import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { bindLayoutControl } from "@/shared/layout/bindings"

/** Dispose panel effects when its course page is replaced. */
export function mountCoursePanel(container: HTMLElement, content: ReactNode): void {
  const binding = bindLayoutControl(`course-panel:${container.id}`, container)
  if (!binding) return
  const root = createRoot(container)
  binding.onCleanup(() => root.unmount())
  root.render(content)
}
