import * as React from "react"
import {
  Download,
  Eye,
  FileDown,
  FileText,
  Upload,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilePreviewModal } from "@/components/ui/file-preview-modal"
import { uploadHomeworkAttachment } from "@/lib/homeworkUpload"
import type {
  HomeworkDetailResponse,
  HomeworkDetailUpload,
  HomeworkSubmission,
  ProcessedHomework,
  SubmissionUpload
} from "@/types"

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"

  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
}

async function fetchHomeworkDetail(
  activityId: number
): Promise<HomeworkDetailResponse | null> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/activities/${activityId}`
    )

    if (!response.ok) return null

    return response.json()
  } catch (error) {
    console.error("XZZDPRO: failed to fetch homework detail", error)
    return null
  }
}

async function fetchSubmissionList(
  activityId: number,
  userId: string
): Promise<HomeworkSubmission[]> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/activities/${activityId}/students/${userId}/submission_list`
    )

    if (!response.ok) return []

    const data = await response.json()
    return data.list || []
  } catch (error) {
    console.error("XZZDPRO: failed to fetch submission list", error)
    return []
  }
}

async function uploadFile(file: File): Promise<number | null> {
  return uploadHomeworkAttachment(file)
}

async function submitHomework(
  activityId: number,
  uploadIds: number[]
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://courses.zju.edu.cn/api/course/activities/${activityId}/submissions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      console.error("XZZDPRO: submit homework failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      return false
    }

    return true
  } catch (error) {
    console.error("XZZDPRO: failed to submit homework", error)
    return false
  }
}

function SubmittedFileItem({ upload }: { upload: SubmissionUpload }) {
  const [showPreview, setShowPreview] = React.useState(false)
  const downloadUrl = `https://courses.zju.edu.cn/api/uploads/${upload.id}/blob`

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm">
        <FileText className="h-7 w-7 flex-shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{upload.name}</div>
          <div className="text-xs text-muted-foreground">
            {formatFileSize(upload.size)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="h-4 w-4" />
            <span>{"\u9884\u89c8"}</span>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <a
              href={downloadUrl}
              download={upload.name}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="h-4 w-4" />
              <span>{"\u4e0b\u8f7d"}</span>
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

function TeacherFileItem({ upload }: { upload: HomeworkDetailUpload }) {
  const [showPreview, setShowPreview] = React.useState(false)
  const downloadUrl = `https://courses.zju.edu.cn/api/uploads/${upload.id}/blob`

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm">
        <FileDown className="h-7 w-7 flex-shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{upload.name}</div>
          <div className="text-xs text-muted-foreground">
            {formatFileSize(upload.size)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="h-4 w-4" />
            <span>{"\u9884\u89c8"}</span>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <a
              href={downloadUrl}
              download={upload.name}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="h-4 w-4" />
              <span>{"\u4e0b\u8f7d"}</span>
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
  const [submissions, setSubmissions] = React.useState<HomeworkSubmission[] | null>(
    null
  )
  const [submissionsLoading, setSubmissionsLoading] = React.useState(false)
  const [homeworkDetail, setHomeworkDetail] =
    React.useState<HomeworkDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [submitStatus, setSubmitStatus] = React.useState<
    "idle" | "uploading" | "submitting" | "success" | "error"
  >("idle")
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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

  const latestSubmission = submissions?.find(
    (submission) => submission.is_latest_version && submission.marked_submitted
  )

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
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return

    setSubmitStatus("uploading")
    const uploadedIds: number[] = []

    for (const file of selectedFiles) {
      const uploadId = await uploadFile(file)
      if (uploadId) uploadedIds.push(uploadId)
    }

    if (uploadedIds.length === 0) {
      setSubmitStatus("error")
      return
    }

    setSubmitStatus("submitting")
    const success = await submitHomework(homework.id, uploadedIds)

    if (success) {
      setSubmitStatus("success")
      setSelectedFiles([])

      const newSubmissions = await fetchSubmissionList(homework.id, userId)
      setSubmissions(newSubmissions)
      window.setTimeout(() => setSubmitStatus("idle"), 2000)
      return
    }

    setSubmitStatus("error")
  }

  const sectionClassName = "rounded-xl border border-border/60 bg-muted/15 p-4"

  return (
    <div className="space-y-4">
      {detailLoading ? (
        <div className={sectionClassName}>
          <p className="text-sm text-muted-foreground">
            {"\u6b63\u5728\u52a0\u8f7d\u4f5c\u4e1a\u8be6\u60c5..."}
          </p>
        </div>
      ) : homeworkDetail &&
        (homeworkDetail.data.description || homeworkDetail.uploads.length > 0) ? (
        <div className="space-y-4">
          {homeworkDetail.data.description && (
            <div className={sectionClassName}>
              <h4 className="mb-3 text-sm font-semibold text-foreground">
                {"\u4f5c\u4e1a\u8bf4\u660e"}
              </h4>
              <div
                className="rounded-lg bg-card/70 p-4 text-sm leading-7 text-foreground"
                dangerouslySetInnerHTML={{
                  __html: homeworkDetail.data.description
                }}
              />
            </div>
          )}

          {homeworkDetail.uploads.length > 0 && (
            <div className={sectionClassName}>
              <h4 className="mb-3 text-sm font-semibold text-foreground">
                {`\u4f5c\u4e1a\u9644\u4ef6 (${homeworkDetail.uploads.length})`}
              </h4>
              <div className="space-y-2">
                {homeworkDetail.uploads.map((upload) => (
                  <TeacherFileItem key={upload.id} upload={upload} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className={sectionClassName}>
        <h4 className="mb-3 text-sm font-semibold text-foreground">
          {"\u5df2\u63d0\u4ea4\u6587\u4ef6"}
        </h4>
        {submissionsLoading ? (
          <p className="text-sm text-muted-foreground">
            {"\u6b63\u5728\u52a0\u8f7d..."}
          </p>
        ) : latestSubmission && latestSubmission.uploads.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {`\u63d0\u4ea4\u65f6\u95f4\uff1a${new Date(latestSubmission.submitted_at).toLocaleString("zh-CN")}`}
            </p>
            <div className="space-y-2">
              {latestSubmission.uploads.map((upload) => (
                <SubmittedFileItem key={upload.id} upload={upload} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {"\u6682\u65e0\u5df2\u63d0\u4ea4\u6587\u4ef6"}
          </p>
        )}
      </div>

      {!homework.isClosed && (
        <div className={sectionClassName}>
          <h4 className="mb-3 text-sm font-semibold text-foreground">
            {"\u4e0a\u4f20\u4f5c\u4e1a"}
          </h4>
          <div
            className="rounded-xl border-2 border-dashed border-border bg-card/60 p-6 text-center transition-all hover:border-primary hover:bg-primary/5"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.classList.add("border-primary", "bg-primary/5")
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("border-primary", "bg-primary/5")
            }}
            onDrop={(e) => {
              e.currentTarget.classList.remove("border-primary", "bg-primary/5")
              handleDrop(e)
            }}
          >
            <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {"\u62d6\u62fd\u6587\u4ef6\u5230\u6b64\u5904\uff0c\u6216\u70b9\u51fb\u9009\u62e9\u6587\u4ef6"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFileSelect}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 p-3"
                >
                  <span className="flex-1 break-all text-sm">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                    onClick={() => handleRemoveFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            className="mt-4 w-full"
            disabled={
              selectedFiles.length === 0 ||
              submitStatus === "uploading" ||
              submitStatus === "submitting"
            }
            onClick={handleSubmit}
            variant={submitStatus === "error" ? "destructive" : "default"}
          >
            {submitStatus === "uploading"
              ? "\u6b63\u5728\u4e0a\u4f20..."
              : submitStatus === "submitting"
                ? "\u6b63\u5728\u63d0\u4ea4..."
                : submitStatus === "success"
                  ? "\u63d0\u4ea4\u6210\u529f"
                  : submitStatus === "error"
                    ? "\u63d0\u4ea4\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5"
                    : "\u63d0\u4ea4\u4f5c\u4e1a"}
          </Button>
        </div>
      )}
    </div>
  )
}
