import { sendToBackground } from "@plasmohq/messaging"

import type { UploadResponse } from "@/background/upload"

// Extension messages are JSON-serialized: a base64 string is ~1.33x the file
// size, while a number[] of bytes is ~3-4x and much slower to encode.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export async function uploadHomeworkAttachment(
  file: File
): Promise<number | null> {
  try {
    const fileData = arrayBufferToBase64(await file.arrayBuffer())
    const response = (await sendToBackground({
      name: "upload-file",
      body: {
        fileName: file.name,
        fileSize: file.size,
        fileData,
        encoding: "base64"
      }
    } as any)) as UploadResponse

    if (response?.success && typeof response.uploadId === "number") {
      return response.uploadId
    }

    console.error(
      "XZZDPRO: upload failed",
      response?.error ?? "Unknown upload error"
    )
    return null
  } catch (error) {
    console.error("XZZDPRO: failed to upload file", error)
    return null
  }
}
