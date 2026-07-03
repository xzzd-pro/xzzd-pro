import { uploadHomeworkAttachment } from "@/features/homework/homeworkUpload"
import type { HomeworkSubmission, SubmissionUpload } from "@/types"

export async function fetchHomeworkSubmissions(
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

export async function uploadHomeworkFile(file: File): Promise<number | null> {
  return uploadHomeworkAttachment(file)
}

export async function submitHomework(
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

export function createSubmissionUpload(
  uploadId: number,
  file: File
): SubmissionUpload {
  return {
    id: uploadId,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    created_at: new Date().toISOString(),
    allow_download: true
  }
}

function getSubmissionUploads(
  submission: HomeworkSubmission
): SubmissionUpload[] {
  const source = submission as unknown as Record<string, unknown>
  const uploadFields = [
    "uploads",
    "attachments",
    "attachment_uploads",
    "submitted_uploads",
    "files",
    "uploads_in_rich_text"
  ]
  const uploads: SubmissionUpload[] = []

  const appendUpload = (value: unknown) => {
    if (!value || typeof value !== "object") return

    const upload = value as Partial<SubmissionUpload>
    if (typeof upload.id !== "number" || !upload.name) return

    uploads.push({
      id: upload.id,
      name: upload.name,
      size: typeof upload.size === "number" ? upload.size : 0,
      type: upload.type || "application/octet-stream",
      created_at: upload.created_at || submission.submitted_at || "",
      allow_download: upload.allow_download ?? true
    })
  }

  for (const field of uploadFields) {
    const value = source[field]
    if (Array.isArray(value)) {
      value.forEach(appendUpload)
    }
  }

  appendUpload(source.upload)

  return dedupeUploads(uploads)
}

function getSubmissionTimestamp(submission: HomeworkSubmission): number {
  const timestamp = Date.parse(submission.submitted_at || "")
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getUploadKey(upload: SubmissionUpload): string {
  return upload.id
    ? `id:${upload.id}`
    : `file:${upload.name}:${upload.size}`
}

function dedupeUploads(uploads: SubmissionUpload[]): SubmissionUpload[] {
  const seenUploads = new Set<string>()
  const uniqueUploads: SubmissionUpload[] = []

  for (const upload of uploads) {
    const key = getUploadKey(upload)
    if (seenUploads.has(key)) continue

    seenUploads.add(key)
    uniqueUploads.push(upload)
  }

  return uniqueUploads
}

function getSubmissionBatchKey(submission: HomeworkSubmission): string {
  const source = submission as unknown as Record<string, unknown>
  const batchFields = [
    "version_id",
    "submission_version",
    "version",
    "revision",
    "attempt",
    "attempt_number",
    "submit_count"
  ]

  for (const field of batchFields) {
    const value = source[field]
    if (typeof value === "string" || typeof value === "number") {
      return `${field}:${value}`
    }
  }

  return ""
}

function buildSubmittedFiles(
  submissions: HomeworkSubmission[]
): { submittedAt: string; uploads: SubmissionUpload[] } | null {
  const submittedAt =
    submissions
      .map((submission) => submission.submitted_at)
      .filter(Boolean)
      .sort()
      .at(-1) || ""
  const uploads = dedupeUploads(submissions.flatMap(getSubmissionUploads))

  if (uploads.length === 0) return null

  return {
    submittedAt,
    uploads
  }
}

export function getLatestSubmittedFiles(
  submissions: HomeworkSubmission[] | null
): { submittedAt: string; uploads: SubmissionUpload[] } | null {
  if (!submissions?.length) return null

  const candidates = submissions.filter(
    (submission) =>
      !submission.is_draft && getSubmissionUploads(submission).length > 0
  )
  if (candidates.length === 0) return null

  const submitted = candidates.filter(
    (submission) => submission.marked_submitted || submission.is_latest_version
  )
  const sourceSubmissions = submitted.length > 0 ? submitted : candidates

  const latest = sourceSubmissions.filter(
    (submission) => submission.is_latest_version
  )
  const newestSubmission = [...sourceSubmissions].sort(
    (a, b) => getSubmissionTimestamp(b) - getSubmissionTimestamp(a)
  )[0]
  const latestTimestamp =
    latest.length > 0
      ? Math.max(...latest.map(getSubmissionTimestamp))
      : getSubmissionTimestamp(newestSubmission)
  const latestBatchKeys = new Set(
    latest.map(getSubmissionBatchKey).filter(Boolean)
  )
  const visibleSubmissions =
    latest.length > 0
      ? sourceSubmissions.filter(
          (submission) =>
            submission.is_latest_version ||
            latestBatchKeys.has(getSubmissionBatchKey(submission)) ||
            getSubmissionTimestamp(submission) === latestTimestamp
        )
      : sourceSubmissions.filter(
          (submission) => getSubmissionTimestamp(submission) === latestTimestamp
        )
  const visibleFiles = buildSubmittedFiles(visibleSubmissions)

  if (visibleFiles && visibleFiles.uploads.length > 1) {
    return visibleFiles
  }

  const batchWindowMs = 5 * 60 * 1000
  const batchSubmissions = candidates.filter((submission) => {
    const timestamp = getSubmissionTimestamp(submission)

    return (
      latestBatchKeys.has(getSubmissionBatchKey(submission)) ||
      (latestTimestamp > 0 &&
        timestamp > 0 &&
        Math.abs(timestamp - latestTimestamp) <= batchWindowMs)
    )
  })
  const batchFiles = buildSubmittedFiles(batchSubmissions)

  if (
    batchFiles &&
    (!visibleFiles || batchFiles.uploads.length > visibleFiles.uploads.length)
  ) {
    return batchFiles
  }

  return visibleFiles
}

export function mergeSubmittedFiles(
  primary: { submittedAt: string; uploads: SubmissionUpload[] } | null,
  fallback: { submittedAt: string; uploads: SubmissionUpload[] } | null
): { submittedAt: string; uploads: SubmissionUpload[] } | null {
  if (!primary) return fallback
  if (!fallback) return primary

  return {
    submittedAt: primary.submittedAt || fallback.submittedAt,
    uploads: dedupeUploads([...primary.uploads, ...fallback.uploads])
  }
}
