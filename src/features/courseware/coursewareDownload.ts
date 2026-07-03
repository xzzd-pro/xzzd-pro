import { zipSync } from "fflate"
import { sendToBackground } from "@plasmohq/messaging"
import type { ProcessedCoursewareFile } from "@/types"

export interface CoursewareZipEntry {
  file: ProcessedCoursewareFile
  folder?: string
}

interface DownloadCoursewareZipOptions {
  archiveName: string
  entries: CoursewareZipEntry[]
  onProgress?: (completed: number, total: number) => void
}

interface FetchFileResponse {
  dataUri?: string
  error?: string
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()

  return sanitized || "未命名"
}

function ensureZipName(value: string): string {
  const sanitized = sanitizePathSegment(value)
  return sanitized.toLowerCase().endsWith(".zip")
    ? sanitized
    : `${sanitized}.zip`
}

function withDuplicateSuffix(name: string, index: number): string {
  if (index <= 1) return name

  const dotIndex = name.lastIndexOf(".")
  if (dotIndex <= 0) return `${name} (${index})`

  return `${name.slice(0, dotIndex)} (${index})${name.slice(dotIndex)}`
}

function buildZipPath(
  entry: CoursewareZipEntry,
  usedPaths: Map<string, number>
): string {
  const fileName = sanitizePathSegment(entry.file.name)
  const folder = entry.folder ? sanitizePathSegment(entry.folder) : ""
  const basePath = folder ? `${folder}/${fileName}` : fileName
  const duplicateCount = (usedPaths.get(basePath) || 0) + 1

  usedPaths.set(basePath, duplicateCount)

  if (duplicateCount === 1) return basePath

  return folder
    ? `${folder}/${withDuplicateSuffix(fileName, duplicateCount)}`
    : withDuplicateSuffix(fileName, duplicateCount)
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function fetchFileBytesDirect(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    credentials: "include"
  })

  if (!response.ok) {
    throw new Error(
      `Direct fetch failed: ${response.status} ${response.statusText}`
    )
  }

  return new Uint8Array(await response.arrayBuffer())
}

async function fetchFileBytesViaBackground(url: string): Promise<Uint8Array> {
  const response = (await sendToBackground({
    name: "fetch-file",
    body: { url }
  } as any)) as FetchFileResponse

  if (response.error) {
    throw new Error(response.error)
  }

  if (!response.dataUri) {
    throw new Error("No data received")
  }

  return new Uint8Array(await (await fetch(response.dataUri)).arrayBuffer())
}

async function fetchFileBytes(url: string): Promise<Uint8Array> {
  try {
    return await fetchFileBytesDirect(url)
  } catch (error) {
    console.warn("XZZDPRO: direct courseware fetch failed, using background", {
      url,
      error: error instanceof Error ? error.message : String(error)
    })
    return await fetchFileBytesViaBackground(url)
  }
}

export async function downloadCoursewareZip({
  archiveName,
  entries,
  onProgress
}: DownloadCoursewareZipOptions): Promise<void> {
  const downloadableEntries = entries.filter((entry) => entry.file.canDownload)
  if (downloadableEntries.length === 0) {
    throw new Error("No downloadable courseware files")
  }

  const zipEntries: Record<string, Uint8Array> = {}
  const usedPaths = new Map<string, number>()
  let completed = 0

  for (const entry of downloadableEntries) {
    zipEntries[buildZipPath(entry, usedPaths)] = await fetchFileBytes(
      entry.file.downloadUrl
    )
    completed += 1
    onProgress?.(completed, downloadableEntries.length)
  }

  const zipped = zipSync(zipEntries, { level: 6 })
  triggerBlobDownload(
    new Blob([zipped], { type: "application/zip" }),
    ensureZipName(archiveName)
  )
}
