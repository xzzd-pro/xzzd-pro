/** Plasmo 0.90's development port listener does not read runtime.lastError. */
export function handleDevelopmentPort(port: chrome.runtime.Port): void {
  if (!port.name.startsWith("__plasmo_runtime_page_") &&
      !port.name.startsWith("__plasmo_runtime_script_")) return

  port.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError
    if (!error) return
    const message = error.message || ""
    if (/back\/forward cache|message (?:channel|port) (?:is )?closed/i.test(message)) {
      // A page leaving the active document closes its development connection.
      return
    }
    console.error("XZZDPRO: Development connection failed", message)
  })
}
