export function removeAirChatbot(): void {
  document.querySelectorAll("air-chatbot-app").forEach((element) => {
    element.remove()
  })
}

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
