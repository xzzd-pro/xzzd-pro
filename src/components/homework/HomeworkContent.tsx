import * as React from "react"
import { Upload, X, FileText, Eye, Download, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilePreviewModal } from "@/components/ui/file-preview-modal"
import type { ProcessedHomework, HomeworkSubmission, SubmissionUpload, HomeworkDetailResponse, HomeworkDetailUpload } from "@/types"

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

// Fetch homework detail
async function fetchHomeworkDetail(activityId: number): Promise<HomeworkDetailResponse | null> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/activities/${activityId}`
    )
    if (!response.ok) return null
    const data = await response.json()
    return data
  } catch (error) {
    console.error('XZZDPRO: 获取作业详情时出错', error)
    return null
  }
}

// Fetch submissions
async function fetchSubmissionList(activityId: number, userId: string): Promise<HomeworkSubmission[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/activities/${activityId}/students/${userId}/submission_list`
    )
    if (!response.ok) return []
    const data = await response.json()
    return data.list || []
  } catch (error) {
    console.error('XZZDPRO: 获取提交列表时出错', error)
    return []
  }
}

// Upload file
async function uploadFile(file: File): Promise<number | null> {
  try {
    const fileData = await file.arrayBuffer()
    // Convert ArrayBuffer to Array for message passing
    const fileArray = Array.from(new Uint8Array(fileData))
    const response = await chrome.runtime.sendMessage({
      type: 'UPLOAD_FILE',
      fileName: file.name,
      fileSize: file.size,
      fileData: fileArray
    })
    if (response && response.success) {
      return response.uploadId
    } else {
      console.error('XZZDPRO: 上传失败', response?.error)
      return null
    }
  } catch (error) {
    console.error('XZZDPRO: 上传文件时出错', error)
    return null
  }
}

// Submit homework
async function submitHomework(activityId: number, uploadIds: number[]): Promise<boolean> {
  try {
    console.log('XZZDPRO: 提交作业 API 请求', {
      activityId,
      uploadIds,
      url: `https://courses.zju.edu.cn/api/course/activities/${activityId}/submissions`
    })

    const response = await fetch(
      `https://courses.zju.edu.cn/api/course/activities/${activityId}/submissions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          comment: "",
          uploads: uploadIds,
          slides: [],
          is_draft: false,
          mode: "normal",
          other_resources: [],
          uploads_in_rich_text: []
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('XZZDPRO: 提交作业失败', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      return false
    }

    const result = await response.json()
    console.log('XZZDPRO: 提交作业成功', result)
    return true
  } catch (error) {
    console.error('XZZDPRO: 提交作业时出错', error)
    return false
  }
}

// Submitted file item component
function SubmittedFileItem({ upload }: { upload: SubmissionUpload }) {
  const [showPreview, setShowPreview] = React.useState(false)

  // Construct download URL for submitted files
  const downloadUrl = `https://courses.zju.edu.cn/api/uploads/${upload.id}/blob`

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-card rounded-lg">
        <FileText className="w-7 h-7 text-primary flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-medium">{upload.name}</div>
          <div className="text-xs text-muted-foreground">{formatFileSize(upload.size)}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="w-4 h-4" />
            <span>预览</span>
          </Button>
          <Button
            asChild
            size="sm"
            className="gap-1.5"
          >
            <a
              href={downloadUrl}
              download={upload.name}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="w-4 h-4" />
              <span>下载</span>
            </a>
          </Button>
        </div>
      </div>

      <FilePreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        fileName={upload.name}
        fileUrl={downloadUrl}
        fileSize={formatFileSize(upload.size)}
        canDownload={true}
      />
    </>
  )
}

// Teacher uploaded file item component
function TeacherFileItem({ upload }: { upload: HomeworkDetailUpload }) {
  const [showPreview, setShowPreview] = React.useState(false)

  // Construct download URL for teacher files
  const downloadUrl = `https://courses.zju.edu.cn/api/uploads/${upload.id}/blob`

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
        <FileDown className="w-7 h-7 text-blue-600 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-medium">{upload.name}</div>
          <div className="text-xs text-muted-foreground">{formatFileSize(upload.size)}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="w-4 h-4" />
            <span>预览</span>
          </Button>
          <Button
            asChild
            size="sm"
            className="gap-1.5"
          >
            <a
              href={downloadUrl}
              download={upload.name}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="w-4 h-4" />
              <span>下载</span>
            </a>
          </Button>
        </div>
      </div>

      <FilePreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        fileName={upload.name}
        fileUrl={downloadUrl}
        fileSize={formatFileSize(upload.size)}
        canDownload={true}
      />
    </>
  )
}

interface HomeworkContentProps {
  homework: ProcessedHomework
  userId: string
}

export function HomeworkContent({ homework, userId }: HomeworkContentProps) {
  const [submissions, setSubmissions] = React.useState<HomeworkSubmission[] | null>(null)
  const [submissionsLoading, setSubmissionsLoading] = React.useState(false)
  const [homeworkDetail, setHomeworkDetail] = React.useState<HomeworkDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [submitStatus, setSubmitStatus] = React.useState<'idle' | 'uploading' | 'submitting' | 'success' | 'error'>('idle')
  const [isSubmitted, setIsSubmitted] = React.useState(homework.submitted)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Load homework detail and submissions on mount
  React.useEffect(() => {
    setDetailLoading(true)
    setSubmissionsLoading(true)

    Promise.all([
      fetchHomeworkDetail(homework.id),
      fetchSubmissionList(homework.id, userId)
    ]).then(([detail, submissionData]) => {
      setHomeworkDetail(detail)
      setSubmissions(submissionData)
      setDetailLoading(false)
      setSubmissionsLoading(false)
    })
  }, [homework.id, userId])

  const latestSubmission = submissions?.find(s => s.is_latest_version && s.marked_submitted)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer?.files) {
      setSelectedFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return

    console.log('XZZDPRO: 开始提交作业，文件数量:', selectedFiles.length)
    setSubmitStatus('uploading')
    const uploadedIds: number[] = []

    // 步骤1: 上传所有文件到个人文件库
    for (const file of selectedFiles) {
      console.log('XZZDPRO: 正在上传文件:', file.name, '大小:', file.size)
      const uploadId = await uploadFile(file)
      if (uploadId) {
        console.log('XZZDPRO: 文件上传成功，uploadId:', uploadId)
        uploadedIds.push(uploadId)
      } else {
        console.error('XZZDPRO: 文件上传失败:', file.name)
      }
    }

    if (uploadedIds.length === 0) {
      console.error('XZZDPRO: 所有文件上传失败')
      setSubmitStatus('error')
      return
    }

    console.log('XZZDPRO: 文件上传完成，uploadIds:', uploadedIds)

    // 步骤2: 提交作业（使用上传的文件ID）
    setSubmitStatus('submitting')
    console.log('XZZDPRO: 正在提交作业，activityId:', homework.id)
    const success = await submitHomework(homework.id, uploadedIds)

    if (success) {
      console.log('XZZDPRO: 作业提交成功')
      setSubmitStatus('success')
      setSelectedFiles([])
      setIsSubmitted(true)
      // Reload submissions
      const newSubmissions = await fetchSubmissionList(homework.id, userId)
      setSubmissions(newSubmissions)
      setTimeout(() => setSubmitStatus('idle'), 2000)
    } else {
      console.error('XZZDPRO: 作业提交失败')
      setSubmitStatus('error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Homework Description and Attachments */}
      {detailLoading ? (
        <div className="text-muted-foreground text-sm">正在加载作业详情...</div>
      ) : homeworkDetail && (homeworkDetail.data.description || homeworkDetail.uploads.length > 0) ? (
        <div className="space-y-4">
          {/* Description */}
          {homeworkDetail.data.description && (
            <div>
              <h4 className="text-[15px] font-semibold mb-3 pb-2 border-b border-border">作业说明</h4>
              <div
                className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-4 rounded-lg"
                dangerouslySetInnerHTML={{ __html: homeworkDetail.data.description }}
              />
            </div>
          )}

          {/* Teacher Attachments */}
          {homeworkDetail.uploads.length > 0 && (
            <div>
              <h4 className="text-[15px] font-semibold mb-3 pb-2 border-b border-border">
                作业附件 ({homeworkDetail.uploads.length})
              </h4>
              <div className="flex flex-col gap-2">
                {homeworkDetail.uploads.map(upload => (
                  <TeacherFileItem
                    key={upload.id}
                    upload={upload}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Submissions */}
      <div>
        <h4 className="text-[15px] font-semibold mb-4 pb-2 border-b border-border">已提交文件</h4>
        {submissionsLoading ? (
          <p className="text-muted-foreground text-sm">正在加载...</p>
        ) : latestSubmission && latestSubmission.uploads.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              提交时间: {new Date(latestSubmission.submitted_at).toLocaleString('zh-CN')}
            </p>
            <div className="flex flex-col gap-2">
              {latestSubmission.uploads.map(upload => (
                <SubmittedFileItem
                  key={upload.id}
                  upload={upload}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">暂无已提交文件</p>
        )}
      </div>

      {/* Upload area (only for non-closed homework) */}
      {!homework.isClosed && (
        <div>
          <h4 className="text-[15px] font-semibold mb-4 pb-2 border-b border-border">上传作业</h4>
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-all hover:border-primary hover:bg-primary/5"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5') }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5') }}
            onDrop={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); handleDrop(e) }}
          >
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">拖拽文件到此处或点击选择文件</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFileSelect}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                  <span className="flex-1 text-sm break-all">{file.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{formatFileSize(file.size)}</span>
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive hover:text-white transition-colors text-muted-foreground"
                    onClick={() => handleRemoveFile(index)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full mt-4"
            disabled={selectedFiles.length === 0 || submitStatus === 'uploading' || submitStatus === 'submitting'}
            onClick={handleSubmit}
            variant={submitStatus === 'success' ? 'default' : submitStatus === 'error' ? 'destructive' : 'default'}
          >
            {submitStatus === 'uploading' ? '正在上传...' :
             submitStatus === 'submitting' ? '正在提交...' :
             submitStatus === 'success' ? '提交成功!' :
             submitStatus === 'error' ? '提交失败，请重试' :
             '提交作业'}
          </Button>
        </div>
      )}
    </div>
  )
}
