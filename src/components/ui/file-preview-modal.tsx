import * as React from "react"
import { createPortal } from "react-dom"
import {
  Archive,
  Download,
  File,
  FileText,
  Image,
  Maximize2,
  Minimize2,
  Music,
  Video,
  X
} from "lucide-react"

import {
  convertPdfToImages,
  fetchFileContent,
  fetchPdfBlob
} from "@/assistant/services/fileService"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  fileName: string
  fileUrl: string
  fileSize?: string
  canDownload?: boolean
}

const WORD_EXTENSIONS = ["doc", "docx"]
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg"]
const VIDEO_EXTENSIONS = ["mp4", "avi", "mov"]
const AUDIO_EXTENSIONS = ["mp3", "wav"]
const TEXT_EXTENSIONS = [
  ...WORD_EXTENSIONS,
  "ppt",
  "pptx",
  "txt",
  "md",
  "json",
  "py",
  "java",
  "js",
  "ts",
  "c",
  "cpp",
  "h"
]

function getFileTypeInfo(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || ""

  const typeMap: Record<
    string,
    { type: string; icon: React.ReactNode; color: string }
  > = {
    pdf: {
      type: "PDF 文档",
      icon: <FileText className="h-5 w-5" />,
      color: "text-red-500"
    },
    doc: {
      type: "Word 文档",
      icon: <FileText className="h-5 w-5" />,
      color: "text-blue-500"
    },
    docx: {
      type: "Word 文档",
      icon: <FileText className="h-5 w-5" />,
      color: "text-blue-500"
    },
    ppt: {
      type: "PowerPoint",
      icon: <FileText className="h-5 w-5" />,
      color: "text-orange-500"
    },
    pptx: {
      type: "PowerPoint",
      icon: <FileText className="h-5 w-5" />,
      color: "text-orange-500"
    },
    xls: {
      type: "Excel 表格",
      icon: <FileText className="h-5 w-5" />,
      color: "text-green-500"
    },
    xlsx: {
      type: "Excel 表格",
      icon: <FileText className="h-5 w-5" />,
      color: "text-green-500"
    },
    txt: {
      type: "文本文件",
      icon: <FileText className="h-5 w-5" />,
      color: "text-gray-500"
    },
    md: {
      type: "Markdown",
      icon: <FileText className="h-5 w-5" />,
      color: "text-gray-500"
    },
    json: {
      type: "JSON 文件",
      icon: <FileText className="h-5 w-5" />,
      color: "text-yellow-500"
    },
    py: {
      type: "Python 代码",
      icon: <FileText className="h-5 w-5" />,
      color: "text-blue-400"
    },
    java: {
      type: "Java 代码",
      icon: <FileText className="h-5 w-5" />,
      color: "text-red-400"
    },
    js: {
      type: "JavaScript",
      icon: <FileText className="h-5 w-5" />,
      color: "text-yellow-400"
    },
    ts: {
      type: "TypeScript",
      icon: <FileText className="h-5 w-5" />,
      color: "text-blue-400"
    },
    c: {
      type: "C 代码",
      icon: <FileText className="h-5 w-5" />,
      color: "text-gray-600"
    },
    cpp: {
      type: "C++ 代码",
      icon: <FileText className="h-5 w-5" />,
      color: "text-gray-600"
    },
    h: {
      type: "头文件",
      icon: <FileText className="h-5 w-5" />,
      color: "text-gray-600"
    },
    jpg: {
      type: "图片",
      icon: <Image className="h-5 w-5" />,
      color: "text-purple-500"
    },
    jpeg: {
      type: "图片",
      icon: <Image className="h-5 w-5" />,
      color: "text-purple-500"
    },
    png: {
      type: "图片",
      icon: <Image className="h-5 w-5" />,
      color: "text-purple-500"
    },
    gif: {
      type: "动图",
      icon: <Image className="h-5 w-5" />,
      color: "text-purple-500"
    },
    webp: {
      type: "图片",
      icon: <Image className="h-5 w-5" />,
      color: "text-purple-500"
    },
    svg: {
      type: "矢量图",
      icon: <Image className="h-5 w-5" />,
      color: "text-purple-500"
    },
    mp4: {
      type: "视频",
      icon: <Video className="h-5 w-5" />,
      color: "text-red-500"
    },
    avi: {
      type: "视频",
      icon: <Video className="h-5 w-5" />,
      color: "text-red-500"
    },
    mov: {
      type: "视频",
      icon: <Video className="h-5 w-5" />,
      color: "text-red-500"
    },
    mp3: {
      type: "音频",
      icon: <Music className="h-5 w-5" />,
      color: "text-green-500"
    },
    wav: {
      type: "音频",
      icon: <Music className="h-5 w-5" />,
      color: "text-green-500"
    },
    zip: {
      type: "压缩包",
      icon: <Archive className="h-5 w-5" />,
      color: "text-yellow-600"
    },
    rar: {
      type: "压缩包",
      icon: <Archive className="h-5 w-5" />,
      color: "text-yellow-600"
    },
    "7z": {
      type: "压缩包",
      icon: <Archive className="h-5 w-5" />,
      color: "text-yellow-600"
    }
  }

  return (
    typeMap[ext] || {
      type: "未知文件",
      icon: <File className="h-5 w-5" />,
      color: "text-gray-400"
    }
  )
}

function canPreviewFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  return [
    "pdf",
    ...TEXT_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
    ...AUDIO_EXTENSIONS
  ].includes(ext)
}

export function FilePreviewModal({
  isOpen,
  onClose,
  fileName,
  fileUrl,
  fileSize,
  canDownload = true
}: FilePreviewModalProps) {
  const [content, setContent] = React.useState("")
  const [pdfImages, setPdfImages] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [totalPdfPages, setTotalPdfPages] = React.useState(0)

  const fileInfo = getFileTypeInfo(fileName)
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  const isPreviewable = canPreviewFile(fileName)
  const isPdf = ext === "pdf"
  const isImage = IMAGE_EXTENSIONS.includes(ext)
  const isVideo = VIDEO_EXTENSIONS.includes(ext)
  const isAudio = AUDIO_EXTENSIONS.includes(ext)
  const isText = TEXT_EXTENSIONS.includes(ext)

  React.useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false)
    }
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen || !isPreviewable) return

    let active = true

    setLoading(true)
    setError("")
    setContent("")
    setPdfImages([])
    setTotalPdfPages(0)

    const loadContent = async () => {
      try {
        if (isPdf) {
          const pdfBlob = await fetchPdfBlob(fileUrl)
          if (!pdfBlob) {
            throw new Error("无法加载 PDF 文件")
          }

          await convertPdfToImages(pdfBlob, {
            maxPages: Number.POSITIVE_INFINITY,
            onPageRendered: (imageDataUrl, pageNumber, totalPages) => {
              if (!active) return
              setPdfImages((prev) => [...prev, imageDataUrl])
              setTotalPdfPages(totalPages)
            },
            shouldContinue: () => active
          })
          return
        }

        if (isImage || isVideo || isAudio) {
          if (active) {
            setContent(fileUrl)
          }
          return
        }

        if (isText) {
          const textContent = await fetchFileContent(fileUrl, fileName)
          if (active) {
            setContent(textContent)
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "加载文件失败")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadContent()

    return () => {
      active = false
    }
  }, [
    fileName,
    fileUrl,
    isAudio,
    isImage,
    isOpen,
    isPdf,
    isPreviewable,
    isText,
    isVideo
  ])

  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const hasLoadedPreview = isPdf ? pdfImages.length > 0 : Boolean(content)
  const showInitialLoadingState = loading && !hasLoadedPreview

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex bg-black/60",
        isFullscreen
          ? "items-stretch justify-stretch p-0"
          : "items-center justify-center p-4"
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden border border-border/70 bg-background shadow-2xl",
          isFullscreen
            ? "h-full w-full rounded-none"
            : "max-h-[90vh] w-full max-w-5xl rounded-xl"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("mt-1 flex-shrink-0", fileInfo.color)}>
              {fileInfo.icon}
            </div>
            <div className="min-w-0">
              <h3 className="break-all text-lg font-semibold">{fileName}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{fileInfo.type}</span>
                {fileSize && (
                  <>
                    <span>·</span>
                    <span>{fileSize}</span>
                  </>
                )}
                {isPdf && totalPdfPages > 0 && (
                  <>
                    <span>·</span>
                    <span>{totalPdfPages} 页</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            {canDownload && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a
                  href={fileUrl}
                  download={fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" />
                  下载
                </a>
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? "退出全屏" : "全屏预览"}
              aria-label={isFullscreen ? "退出全屏" : "全屏预览"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              title="关闭"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-muted/20 p-4 md:p-6">
          {!isPreviewable ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
              <File className="mb-4 h-16 w-16 text-muted-foreground" />
              <h4 className="mb-2 text-lg font-medium">无法预览此文件类型</h4>
              <p className="mb-4 text-muted-foreground">
                {fileInfo.type} 暂不支持在线预览，请下载后查看。
              </p>
            </div>
          ) : error ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
              <div className="mb-4 text-destructive">
                <X className="mx-auto mb-2 h-16 w-16" />
                <h4 className="text-lg font-medium">预览失败</h4>
              </div>
              <p className="mb-4 text-muted-foreground">{error}</p>
              {canDownload && (
                <Button asChild variant="outline">
                  <a
                    href={fileUrl}
                    download={fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    下载文件
                  </a>
                </Button>
              )}
            </div>
          ) : showInitialLoadingState ? (
            <div className="flex h-full min-h-64 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                <p className="text-muted-foreground">正在加载预览...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {isPdf && (
                <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
                  {pdfImages.map((imageUrl, index) => (
                    <section
                      key={`${fileName}-page-${index + 1}`}
                      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                    >
                      <div className="border-b border-border bg-muted/60 px-4 py-2 text-sm font-medium">
                        第 {index + 1} 页
                      </div>
                      <div className="flex justify-center overflow-auto bg-white p-4 md:p-6">
                        <img
                          src={imageUrl}
                          alt={`${fileName} 第 ${index + 1} 页`}
                          className="block h-auto max-w-full rounded-sm shadow-sm"
                        />
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {isImage && (
                <div className="text-center">
                  <img
                    src={content}
                    alt={fileName}
                    className={cn(
                      "mx-auto rounded-lg shadow-sm",
                      isFullscreen
                        ? "max-h-none max-w-full"
                        : "max-h-[70vh] max-w-full"
                    )}
                    onError={() => setError("图片加载失败")}
                  />
                </div>
              )}

              {isVideo && (
                <div className="text-center">
                  <video
                    src={content}
                    controls
                    className={cn(
                      "mx-auto w-full max-w-5xl rounded-lg shadow-sm",
                      isFullscreen ? "max-h-[calc(100dvh-10rem)]" : "max-h-[70vh]"
                    )}
                    onError={() => setError("视频加载失败")}
                  >
                    您的浏览器不支持视频播放。
                  </video>
                </div>
              )}

              {isAudio && (
                <div className="text-center">
                  <div className="inline-flex flex-col items-center gap-4 rounded-lg bg-muted p-8">
                    <Music className="h-16 w-16 text-muted-foreground" />
                    <audio
                      src={content}
                      controls
                      className="w-full max-w-md"
                      onError={() => setError("音频加载失败")}
                    >
                      您的浏览器不支持音频播放。
                    </audio>
                  </div>
                </div>
              )}

              {isText && content && (
                <div className="mx-auto w-full max-w-[1180px] rounded-lg border border-border bg-background shadow-sm">
                  <div className="border-b border-border px-4 py-3 text-sm font-medium">
                    文件内容
                  </div>
                  <pre
                    className={cn(
                      "overflow-auto whitespace-pre-wrap p-4 text-sm font-mono",
                      isFullscreen
                        ? "min-h-[calc(100dvh-12rem)] max-h-none"
                        : "max-h-[70vh]"
                    )}
                  >
                    {content}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
