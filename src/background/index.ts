import {
  uploadHomeworkFile,
  type UploadFileRequest,
  type UploadResponse
} from "./upload"
import { handleDevelopmentPort } from "./developmentPorts"

export {}

if (process.env.NODE_ENV === "development") {
  chrome.runtime.onConnect.addListener(handleDevelopmentPort)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || (message as UploadFileRequest).type !== "UPLOAD_FILE") {
    return
  }

  void uploadHomeworkFile(message as UploadFileRequest)
    .then((response) => {
      sendResponse(response satisfies UploadResponse)
    })
    .catch((error) => {
      const fallback: UploadResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : "Unexpected upload error"
      }
      console.error("XZZDPRO Background: upload request failed", error)
      sendResponse(fallback)
    })

  return true
})

console.log("XZZDPRO: background service worker initialized")
