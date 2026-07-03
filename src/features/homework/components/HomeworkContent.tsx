import { Button } from "@/components/ui/button"
import { FilePreviewModal } from "@/components/ui/file-preview-modal"
import {
  createSubmissionUpload,
  fetchHomeworkSubmissions,
  getLatestSubmittedFiles,
  mergeSubmittedFiles,
  submitHomework,
  uploadHomeworkFile
} from "@/features/homework/homeworkSubmission"
import { formatFileSize } from "@/lib/fileFormat"
import type {
  HomeworkDetailResponse,
  HomeworkDetailUpload,
  HomeworkSubmission,
  ProcessedHomework,
  SubmissionUpload
} from "@/types"
import { Download, Eye, FileDown, FileText, Upload, X } from "lucide-react"
import * as React from "react"

function getFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function appendSelectedFiles(current: File[], incoming: File[]): File[] {
  const seen = new Set(current.map(getFileKey))
  const next = [...current]

  for (const file of incoming) {
    const key = getFileKey(file)
    if (seen.has(key)) continue

    seen.add(key)
    next.push(file)
  }

  return next
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
            onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4" />
            <span>{"\u9884\u89c8"}</span>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <a
              href={downloadUrl}
              download={upload.name}
              target="_blank"
              rel="noopener noreferrer">
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
            onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4" />
            <span>{"\u9884\u89c8"}</span>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <a
              href={downloadUrl}
              download={upload.name}
              target="_blank"
              rel="noopener noreferrer">
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
  const [submissions, setSubmissions] = React.useState<
    HomeworkSubmission[] | null
  >(null)
  const [submissionsLoading, setSubmissionsLoading] = React.useState(false)
  const [homeworkDetail, setHomeworkDetail] =
    React.useState<HomeworkDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [optimisticSubmittedFiles, setOptimisticSubmittedFiles] =
    React.useState<{
      submittedAt: string
      uploads: SubmissionUpload[]
    } | null>(null)
  const [submitStatus, setSubmitStatus] = React.useState<
    "idle" | "uploading" | "submitting" | "success" | "error"
  >("idle")
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setDetailLoading(true)
    setSubmissionsLoading(true)

    Promise.all([
      fetchHomeworkDetail(homework.id),
      fetchHomeworkSubmissions(homework.id, userId)
    ]).then(([detail, submissionData]) => {
      setHomeworkDetail(detail)
      setSubmissions(submissionData)
      setDetailLoading(false)
      setSubmissionsLoading(false)
    })
    setOptimisticSubmittedFiles(null)
  }, [homework.id, userId])

  const latestSubmittedFiles = mergeSubmittedFiles(
    getLatestSubmittedFiles(submissions),
    optimisticSubmittedFiles
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || [])
    if (files.length === 0) return

    setSelectedFiles((prev) => appendSelectedFiles(prev, files))
    e.currentTarget.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length === 0) return

    setSelectedFiles((prev) => appendSelectedFiles(prev, files))
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return

    setSubmitStatus("uploading")
    const uploadedIds: number[] = []
    const uploadedFiles: SubmissionUpload[] = []

    for (const file of selectedFiles) {
      const uploadId = await uploadHomeworkFile(file)
      if (typeof uploadId !== "number") {
        setSubmitStatus("error")
        return
      }

      uploadedIds.push(uploadId)
      uploadedFiles.push(createSubmissionUpload(uploadId, file))
    }

    if (uploadedIds.length !== selectedFiles.length) {
      setSubmitStatus("error")
      return
    }

    setSubmitStatus("submitting")
    const success = await submitHomework(homework.id, uploadedIds)

    if (success) {
      setSubmitStatus("success")
      setSelectedFiles([])
      setOptimisticSubmittedFiles({
        submittedAt: new Date().toISOString(),
        uploads: uploadedFiles
      })

      const newSubmissions = await fetchHomeworkSubmissions(homework.id, userId)
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
        (homeworkDetail.data.description ||
          homeworkDetail.uploads.length > 0) ? (
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
        ) : latestSubmittedFiles && latestSubmittedFiles.uploads.length > 0 ? (
          <div className="space-y-3">
            {latestSubmittedFiles.submittedAt && (
              <p className="text-sm text-muted-foreground">
                {`\u63d0\u4ea4\u65f6\u95f4\uff1a${new Date(latestSubmittedFiles.submittedAt).toLocaleString("zh-CN")}`}
              </p>
            )}
            <div className="space-y-2">
              {latestSubmittedFiles.uploads.map((upload) => (
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

      <div className={sectionClassName}>
        <h4 className="mb-3 text-sm font-semibold text-foreground">
          {"\u6279\u6539\u7ed3\u679c"}
        </h4>
        {!homework.submitted ? (
          <p className="text-sm text-muted-foreground">
            {
              "\u63d0\u4ea4\u4f5c\u4e1a\u540e\u53ef\u67e5\u770b\u6210\u7ee9\u548c\u8001\u5e08\u8bc4\u8bed"
            }
          </p>
        ) : homework.isReviewed ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {"\u6279\u6539\u72b6\u6001\uff1a"}
              </span>
              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300">
                {"\u5df2\u6279\u6539"}
              </span>
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {homework.scorePublished
                  ? "\u5df2\u53d1\u5e03\u6210\u7ee9"
                  : "\u6210\u7ee9\u672a\u53d1\u5e03"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {"\u6210\u7ee9\uff1a"}
              </span>
              <span className="text-lg font-semibold text-primary">
                {homework.score || "--"}
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {"\u8001\u5e08\u8bc4\u8bed"}
              </p>
              <div className="rounded-lg bg-card/70 p-4 text-sm leading-7 text-foreground whitespace-pre-wrap break-words">
                {homework.instructorComment ||
                  "\u6682\u65e0\u8001\u5e08\u8bc4\u8bed"}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {"\u8001\u5e08\u5c1a\u672a\u6279\u6539"}
          </p>
        )}
      </div>

      {homework.canSubmit && (
        <div className={sectionClassName}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {"\u4e0a\u4f20\u4f5c\u4e1a"}
            </h4>
            {selectedFiles.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {`\u5f85\u63d0\u4ea4 ${selectedFiles.length} \u4e2a\u6587\u4ef6`}
              </span>
            )}
          </div>
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
            }}>
            <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {
                "\u62d6\u62fd\u6587\u4ef6\u5230\u6b64\u5904\uff0c\u6216\u70b9\u51fb\u9009\u62e9\u6587\u4ef6"
              }
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
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 p-3">
                  <span className="flex-1 break-all text-sm">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                    onClick={() => handleRemoveFile(index)}>
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
            variant={submitStatus === "error" ? "destructive" : "default"}>
            {submitStatus === "uploading"
              ? "\u6b63\u5728\u4e0a\u4f20..."
              : submitStatus === "submitting"
                ? "\u6b63\u5728\u63d0\u4ea4..."
                : submitStatus === "success"
                  ? "\u63d0\u4ea4\u6210\u529f"
                  : submitStatus === "error"
                    ? "\u63d0\u4ea4\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5"
                    : selectedFiles.length > 1
                      ? `\u63d0\u4ea4 ${selectedFiles.length} \u4e2a\u6587\u4ef6`
                      : "\u63d0\u4ea4\u4f5c\u4e1a"}
          </Button>
        </div>
      )}
    </div>
  )
}
