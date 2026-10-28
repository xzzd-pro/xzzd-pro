import { handleDevelopmentPort } from "./developmentPorts"
import { migrateLegacySyncStorage } from "./migrateStorage"

export {}

if (process.env.NODE_ENV === "development") {
  chrome.runtime.onConnect.addListener(handleDevelopmentPort)
}

// Uploads go through the Plasmo message handler in messages/upload-file.ts.

chrome.runtime.onInstalled.addListener(() => {
  void migrateLegacySyncStorage()
})
