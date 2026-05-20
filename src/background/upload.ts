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
): Promise<{ success: boolean; error?: string }> {
  const bytes = normalizeFileData(fileData)
  const contentType = getContentType(fileName)
  const blob = new Blob([bytes], { type: contentType })

  const uploadAttempts: Array<{
    label: string
    request: () => Promise<Response>
  }> = [
    {
      label: "POST multipart/form-data",
      request: async () => {
        const formData = new FormData()
        formData.append("file", blob, fileName)
        return await fetch(uploadUrl, {
          method: "POST",
          body: formData
        })
      }
    },
    {
      label: "PUT raw blob",
      request: async () =>
        await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": contentType
          },
          body: blob
        })
    },
    {
      label: "POST raw blob",
      request: async () =>
        await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": contentType
          },
          body: blob
        })
    }
  ]

  const errors: string[] = []

  for (const attempt of uploadAttempts) {
    try {
      const response = await attempt.request()
      if (response.ok) {
        return { success: true }
      }

      let errorText = ""
      try {
        errorText = await response.text()
      } catch {
        errorText = "Unable to read upload error response"
      }

      const errorSummary = `${attempt.label}: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.slice(0, 200)}` : ""}`
      errors.push(errorSummary)
      console.error("XZZDPRO Background: file content upload failed", {
        attempt: attempt.label,
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: uploadUrl
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      errors.push(`${attempt.label}: ${errorMessage}`)
      console.error("XZZDPRO Background: file content upload threw", {
        attempt: attempt.label,
        error
      })
    }
  }

  return {
    success: false,
    error: errors.join(" | ")
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

  const uploadResult = await uploadFileContent(
    preRegResult.uploadUrl,
    request.fileData,
    request.fileName
  )
  if (!uploadResult.success) {
    return {
      success: false,
      error: uploadResult.error || "Failed to upload file content."
    }
  }

  return {
    success: true,
    uploadId: preRegResult.id
  }
}
