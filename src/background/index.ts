// background/index.ts
// Background service worker for handling file uploads (bypasses CORS)

export { }

interface UploadRequest {
  type: 'UPLOAD_FILE'
  fileName: string
  fileSize: number
  fileData: number[]  // Array of bytes
}

interface UploadResponse {
  success: boolean
  uploadId?: number
  error?: string
}

// Pre-register upload
async function preRegisterUpload(fileName: string, fileSize: number): Promise<{ id: number; uploadUrl: string } | null> {
  try {
    console.log('XZZDPRO Background: 预注册上传', { fileName, fileSize })
    const response = await fetch('https://courses.zju.edu.cn/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
      console.error('XZZDPRO Background: 预注册上传失败', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      return null
    }

    const data = await response.json()
    console.log('XZZDPRO Background: 预注册成功', { id: data.id, uploadUrl: data.upload_url?.substring(0, 80) + '...' })
    return { id: data.id, uploadUrl: data.upload_url }
  } catch (error) {
    console.error('XZZDPRO Background: 预注册上传出错', error)
    return null
  }
}

// Upload file content using multipart/form-data
async function uploadFileContent(uploadUrl: string, fileData: number[], fileName: string): Promise<boolean> {
  try {
    console.log('XZZDPRO Background: 开始上传文件内容')
    console.log('XZZDPRO Background: Upload URL:', uploadUrl)
    console.log('XZZDPRO Background: 文件名:', fileName)
    console.log('XZZDPRO Background: 文件大小:', fileData.length, 'bytes')

    // Convert array back to Uint8Array/Blob
    const uint8Array = new Uint8Array(fileData)
    const blob = new Blob([uint8Array], { type: getContentType(fileName) })

    console.log('XZZDPRO Background: Blob 大小:', blob.size, 'bytes')
    console.log('XZZDPRO Background: Blob 类型:', blob.type)

    // Use FormData for multipart/form-data upload
    const formData = new FormData()
    formData.append('file', blob, fileName)

    const response = await fetch(uploadUrl, {
      method: 'POST',  // Changed from PUT to POST
      body: formData
    })

    console.log('XZZDPRO Background: 上传响应状态:', response.status, response.statusText)

    if (!response.ok) {
      let errorText = ''
      try {
        errorText = await response.text()
      } catch (e) {
        errorText = '无法读取错误响应'
      }
      console.error('XZZDPRO Background: 上传文件失败', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: uploadUrl
      })
      return false
    }

    console.log('XZZDPRO Background: 文件内容上传成功')
    return true
  } catch (error) {
    console.error('XZZDPRO Background: 上传文件出错', error)
    if (error instanceof Error) {
      console.error('XZZDPRO Background: 错误详情:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      })
    }
    return false
  }
}

// Get content type from file name
function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed'
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message: UploadRequest, sender, sendResponse) => {
  if (message.type === 'UPLOAD_FILE') {
    (async () => {
      try {
        console.log('XZZDPRO Background: 收到上传请求', {
          fileName: message.fileName,
          fileSize: message.fileSize
        })

        // Step 1: Pre-register
        const preRegResult = await preRegisterUpload(message.fileName, message.fileSize)
        if (!preRegResult) {
          const error = '预注册上传失败，请检查网络连接和登录状态'
          console.error('XZZDPRO Background:', error)
          sendResponse({ success: false, error } as UploadResponse)
          return
        }

        console.log('XZZDPRO Background: 预注册成功，准备上传文件内容')

        // Step 2: Upload file content
        const uploadSuccess = await uploadFileContent(preRegResult.uploadUrl, message.fileData, message.fileName)
        if (!uploadSuccess) {
          const error = '上传文件内容失败，upload_url 可能无效或已过期'
          console.error('XZZDPRO Background:', error)
          sendResponse({ success: false, error } as UploadResponse)
          return
        }

        console.log('XZZDPRO Background: 文件上传完成，uploadId:', preRegResult.id)
        sendResponse({ success: true, uploadId: preRegResult.id } as UploadResponse)
      } catch (error) {
        const errorMsg = `处理上传请求出错: ${error instanceof Error ? error.message : String(error)}`
        console.error('XZZDPRO Background:', errorMsg, error)
        sendResponse({ success: false, error: errorMsg } as UploadResponse)
      }
    })()

    // Return true to indicate we will send response asynchronously
    return true
  }
})

console.log('XZZDPRO: Background service worker initialized')
