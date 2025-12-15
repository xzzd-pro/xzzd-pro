// background/index.ts
// Background service worker for handling file uploads (bypasses CORS)

export { }

interface UploadRequest {
  type: 'UPLOAD_FILE'
  fileName: string
  fileSize: number
  fileData: ArrayBuffer
}

interface UploadResponse {
  success: boolean
  uploadId?: number
  error?: string
}

// Pre-register upload
async function preRegisterUpload(fileName: string, fileSize: number): Promise<{ id: number; uploadUrl: string } | null> {
  try {
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
      console.error('XZZDPRO Background: 预注册上传失败', response.status)
      return null
    }

    const data = await response.json()
    return { id: data.id, uploadUrl: data.upload_url }
  } catch (error) {
    console.error('XZZDPRO Background: 预注册上传出错', error)
    return null
  }
}

// Upload file content
async function uploadFileContent(uploadUrl: string, fileData: ArrayBuffer): Promise<boolean> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      credentials: 'include',
      body: fileData
    })

    if (!response.ok) {
      console.error('XZZDPRO Background: 上传文件失败', response.status)
      return false
    }

    return true
  } catch (error) {
    console.error('XZZDPRO Background: 上传文件出错', error)
    return false
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message: UploadRequest, sender, sendResponse) => {
  if (message.type === 'UPLOAD_FILE') {
    (async () => {
      try {
        // Step 1: Pre-register
        const preRegResult = await preRegisterUpload(message.fileName, message.fileSize)
        if (!preRegResult) {
          sendResponse({ success: false, error: '预注册上传失败' } as UploadResponse)
          return
        }

        // Step 2: Upload file content
        const uploadSuccess = await uploadFileContent(preRegResult.uploadUrl, message.fileData)
        if (!uploadSuccess) {
          sendResponse({ success: false, error: '上传文件内容失败' } as UploadResponse)
          return
        }

        sendResponse({ success: true, uploadId: preRegResult.id } as UploadResponse)
      } catch (error) {
        console.error('XZZDPRO Background: 处理上传请求出错', error)
        sendResponse({ success: false, error: String(error) } as UploadResponse)
      }
    })()

    // Return true to indicate we will send response asynchronously
    return true
  }
})

console.log('XZZDPRO: Background service worker initialized')
