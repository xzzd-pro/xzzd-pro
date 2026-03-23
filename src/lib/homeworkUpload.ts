import { sendToBackground } from "@plasmohq/messaging"

import type { UploadResponse } from "@/background/upload"

export async function uploadHomeworkAttachment(
  file: File
): Promise<number | null> {
  try {
    const fileData = await file.arrayBuffer()
    const response = (await sendToBackground({
      name: "upload-file",
      body: {
        fileName: file.name,
        fileSize: file.size,
        fileData
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
