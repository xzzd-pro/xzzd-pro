export interface UploadFileRequest {
  type: "UPLOAD_FILE"
  fileName: string
  fileSize: number
  fileData: number[] | ArrayBuffer | Uint8Array
}

export interface UploadResponse {
  success: boolean
  uploadId?: number
  error?: string
}

async function preRegisterUpload(
  fileName: string,
  fileSize: number
): Promise<{ id: number; uploadUrl: string } | null> {
  try {
    const response = await fetch("https://courses.zju.edu.cn/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: fileName,
        size: fileSize,
        parent_type: null,
        parent_id: 0,
        is_scorm: false,
        is_wmpkg: false,
        source: "",
        is_marked_attachment: false,
        embed_material_type: ""
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("XZZDPRO Background: upload preregistration failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      return null
    }

    const data = await response.json()
    return { id: data.id, uploadUrl: data.upload_url }
  } catch (error) {
    console.error("XZZDPRO Background: upload preregistration threw", error)
    return null
  }
}

function normalizeFileData(fileData: UploadFileRequest["fileData"]): Uint8Array {
  if (fileData instanceof Uint8Array) {
    return fileData
  }

  if (fileData instanceof ArrayBuffer) {
    return new Uint8Array(fileData)
  }

  if (Array.isArray(fileData)) {
    return Uint8Array.from(fileData)
  }

  throw new Error("Unsupported upload payload")
}

async function uploadFileContent(
  uploadUrl: string,
  fileData: UploadFileRequest["fileData"],
  fileName: string
): Promise<boolean> {
  try {
    const bytes = normalizeFileData(fileData)
    const blob = new Blob([bytes], { type: getContentType(fileName) })
    const formData = new FormData()
    formData.append("file", blob, fileName)

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData
    })

    if (!response.ok) {
      let errorText = ""
      try {
        errorText = await response.text()
      } catch {
        errorText = "Unable to read upload error response"
      }

      console.error("XZZDPRO Background: file content upload failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: uploadUrl
      })
      return false
    }

    return true
  } catch (error) {
    console.error("XZZDPRO Background: file content upload threw", error)
    return false
  }
}

function getContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    zip: "application/zip",
    rar: "application/x-rar-compressed"
  }

  return mimeTypes[ext || ""] || "application/octet-stream"
}

export async function uploadHomeworkFile(
  request: UploadFileRequest
): Promise<UploadResponse> {
  const preRegResult = await preRegisterUpload(request.fileName, request.fileSize)
  if (!preRegResult) {
    return {
      success: false,
      error: "Failed to preregister upload. Check login state and network."
    }
  }

  const uploadSuccess = await uploadFileContent(
    preRegResult.uploadUrl,
    request.fileData,
    request.fileName
  )
  if (!uploadSuccess) {
    return {
      success: false,
      error: "Failed to upload file content."
    }
  }

  return {
    success: true,
    uploadId: preRegResult.id
  }
}
