import type { PlasmoMessaging } from "@plasmohq/messaging"

import {
  uploadHomeworkFile,
  type UploadFileRequest,
  type UploadResponse
} from "../upload"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const body = (req.body || {}) as Partial<UploadFileRequest>

  // An empty file encodes to "", which is still a valid payload.
  if (!body.fileName || typeof body.fileSize !== "number" || (typeof body.fileData !== "string" && !body.fileData)) {
    res.send({
      success: false,
      error: "Invalid upload payload"
    } satisfies UploadResponse)
    return
  }

  const response = await uploadHomeworkFile({
    type: "UPLOAD_FILE",
    fileName: body.fileName,
    fileSize: body.fileSize,
    fileData: body.fileData,
    encoding: body.encoding
  })

  res.send(response)
}

export default handler
