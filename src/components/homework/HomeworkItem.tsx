import * as React from "react"
import { cn } from "@/lib/utils"
import { Upload, X, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import type { ProcessedHomework, HomeworkSubmission, SubmissionUpload } from "@/types"

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
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
    const response = await chrome.runtime.sendMessage({
      type: 'UPLOAD_FILE',
      fileName: file.name,
      fileSize: file.size,
      fileData: fileData
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
    return response.ok
  } catch (error) {
    console.error('XZZDPRO: 提交作业时出错', error)
    return false
  }
}

interface HomeworkItemProps {
  homework: ProcessedHomework
  userId: string
}

export function HomeworkItem({ homework, userId }: HomeworkItemProps) {
  const [submissions, setSubmissions] = React.useState<HomeworkSubmission[] | null>(null)
  const [submissionsLoading, setSubmissionsLoading] = React.useState(false)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [submitStatus, setSubmitStatus] = React.useState<'idle' | 'uploading' | 'submitting' | 'success' | 'error'>('idle')
  const [isSubmitted, setIsSubmitted] = React.useState(homework.submitted)
  const [isExpanded, setIsExpanded] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Load submissions on first expand
  React.useEffect(() => {
    if (isExpanded && submissions === null) {
      setSubmissionsLoading(true)
      fetchSubmissionList(homework.id, userId).then(data => {
        setSubmissions(data)
        setSubmissionsLoading(false)
      })
    }
  }, [isExpanded, homework.id, userId, submissions])

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

    setSubmitStatus('uploading')
    const uploadedIds: number[] = []

    for (const file of selectedFiles) {
      const uploadId = await uploadFile(file)
      if (uploadId) uploadedIds.push(uploadId)
    }

    if (uploadedIds.length === 0) {
      setSubmitStatus('error')
      return
    }

    setSubmitStatus('submitting')
    const success = await submitHomework(homework.id, uploadedIds)

    if (success) {
      setSubmitStatus('success')
      setSelectedFiles([])
      setIsSubmitted(true)
      // Reload submissions
      const newSubmissions = await fetchSubmissionList(homework.id, userId)
      setSubmissions(newSubmissions)
      setTimeout(() => setSubmitStatus('idle'), 2000)
    } else {
      setSubmitStatus('error')
    }
  }

  const formatDeadline = (deadline: Date, isClosed: boolean): string => {
    if (isClosed) return `已于 ${deadline.toLocaleDateString('zh-CN')} 截止`
    const now = new Date()
    const diff = deadline.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (days > 0) return `还剩 ${days} 天 ${hours} 小时`
    if (hours > 0) {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      return `还剩 ${hours} 小时 ${minutes} 分钟`
    }
    return '即将截止'
  }

  return (
    <AccordionItem
      value={homework.id.toString()}
      className={cn(
        "bg-muted rounded-lg overflow-hidden border-l-4 shadow-sm transition-all duration-200",
        "hover:translate-x-1 hover:shadow-md",
        homework.isClosed ? "border-l-muted-foreground opacity-85" : "border-l-primary"
      )}
    >
      <AccordionTrigger
        className="flex items-start gap-3 p-6 hover:bg-border/50 transition-colors [&[data-state=open]>svg]:rotate-180"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-4 mb-4">
            <h3 className="flex-1 min-w-0">
              <a
                href={homework.link}
                className="text-xl font-semibold text-foreground hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {homework.title}
              </a>
            </h3>
            <div className="flex gap-2 flex-shrink-0">
              <Badge variant={homework.isClosed ? "secondary" : "default"}>
                {homework.isClosed ? '已结束' : '进行中'}
              </Badge>
              <Badge variant={isSubmitted ? "default" : "outline"}
                className={cn(!isSubmitted && "bg-yellow-500 text-gray-900 border-transparent")}
              >
                {isSubmitted ? '已提交' : '未提交'}
              </Badge>
            </div>
          </div>
          <div className="flex gap-6 flex-wrap pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">截止时间:</span>
              <span className={cn(
                "text-[15px] font-semibold",
                !homework.isClosed && "text-destructive animate-pulse"
              )}>
                {formatDeadline(homework.deadline, homework.isClosed)}
              </span>
            </div>
            {homework.scorePublished && homework.submitted && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">成绩:</span>
                <span className="text-lg font-bold text-primary">{homework.score}</span>
              </div>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6 pl-[60px]">
        <div className="space-y-6">
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
                    <div key={upload.id} className="flex items-center gap-3 p-3 bg-card rounded-lg">
                      <FileText className="w-7 h-7 text-primary flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{upload.name}</div>
                        <div className="text-xs text-muted-foreground">{formatFileSize(upload.size)}</div>
                      </div>
                    </div>
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
      </AccordionContent>
    </AccordionItem>
  )
}
