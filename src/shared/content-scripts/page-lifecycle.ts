/**
 * Removes the course site's floating AI chatbot widget from the page.
 */
export function removeAirChatbot(): void {
  document.querySelectorAll("air-chatbot-app").forEach((element) => {
    element.remove()
  })
}

/**
 * Removes the chatbot widget and keeps removing it if the site re-adds it.
 * @param durationMs How long to keep watching, in ms.
 */
export function suppressAirChatbot(durationMs: number = 5000): void {
  removeAirChatbot()

  const observer = new MutationObserver(() => {
    removeAirChatbot()
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })

  window.setTimeout(() => observer.disconnect(), durationMs)
}
