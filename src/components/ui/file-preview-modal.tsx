import * as React from "react"
import { createPortal } from "react-dom"
import { X, Download, Eye, FileText, Image, Video, Music, Archive, File } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchFileContent, fetchPdfBlob, convertPdfToImages } from "@/assistant/services/fileService"

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  fileName: string
  fileUrl: string
  fileSize?: string
  canDownload?: boolean
}

// Get file type and icon
function getFileTypeInfo(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  const typeMap: Record<string, { type: string; icon: React.ReactNode; color: string }> = {
    // Documents
    'pdf': { type: 'PDF文档', icon: <FileText className="w-5 h-5" />, color: 'text-red-500' },
    'doc': { type: 'Word文档', icon: <FileText className="w-5 h-5" />, color: 'text-blue-500' },
    'docx': { type: 'Word文档', icon: <FileText className="w-5 h-5" />, color: 'text-blue-500' },
    'ppt': { type: 'PowerPoint', icon: <FileText className="w-5 h-5" />, color: 'text-orange-500' },
    'pptx': { type: 'PowerPoint', icon: <FileText className="w-5 h-5" />, color: 'text-orange-500' },
    'xls': { type: 'Excel表格', icon: <FileText className="w-5 h-5" />, color: 'text-green-500' },
    'xlsx': { type: 'Excel表格', icon: <FileText className="w-5 h-5" />, color: 'text-green-500' },

    // Text files
    'txt': { type: '文本文件', icon: <FileText className="w-5 h-5" />, color: 'text-gray-500' },
    'md': { type: 'Markdown', icon: <FileText className="w-5 h-5" />, color: 'text-gray-500' },
    'json': { type: 'JSON文件', icon: <FileText className="w-5 h-5" />, color: 'text-yellow-500' },

    // Code files
    'py': { type: 'Python代码', icon: <FileText className="w-5 h-5" />, color: 'text-blue-400' },
    'java': { type: 'Java代码', icon: <FileText className="w-5 h-5" />, color: 'text-red-400' },
    'js': { type: 'JavaScript', icon: <FileText className="w-5 h-5" />, color: 'text-yellow-400' },
    'ts': { type: 'TypeScript', icon: <FileText className="w-5 h-5" />, color: 'text-blue-400' },
    'c': { type: 'C代码', icon: <FileText className="w-5 h-5" />, color: 'text-gray-600' },
    'cpp': { type: 'C++代码', icon: <FileText className="w-5 h-5" />, color: 'text-gray-600' },
    'h': { type: '头文件', icon: <FileText className="w-5 h-5" />, color: 'text-gray-600' },

    // Images
    'jpg': { type: '图片', icon: <Image className="w-5 h-5" />, color: 'text-purple-500' },
    'jpeg': { type: '图片', icon: <Image className="w-5 h-5" />, color: 'text-purple-500' },
    'png': { type: '图片', icon: <Image className="w-5 h-5" />, color: 'text-purple-500' },
    'gif': { type: '动图', icon: <Image className="w-5 h-5" />, color: 'text-purple-500' },
    'webp': { type: '图片', icon: <Image className="w-5 h-5" />, color: 'text-purple-500' },
    'svg': { type: '矢量图', icon: <Image className="w-5 h-5" />, color: 'text-purple-500' },

    // Media
    'mp4': { type: '视频', icon: <Video className="w-5 h-5" />, color: 'text-red-500' },
    'avi': { type: '视频', icon: <Video className="w-5 h-5" />, color: 'text-red-500' },
    'mov': { type: '视频', icon: <Video className="w-5 h-5" />, color: 'text-red-500' },
    'mp3': { type: '音频', icon: <Music className="w-5 h-5" />, color: 'text-green-500' },
    'wav': { type: '音频', icon: <Music className="w-5 h-5" />, color: 'text-green-500' },

    // Archives
    'zip': { type: '压缩包', icon: <Archive className="w-5 h-5" />, color: 'text-yellow-600' },
    'rar': { type: '压缩包', icon: <Archive className="w-5 h-5" />, color: 'text-yellow-600' },
    '7z': { type: '压缩包', icon: <Archive className="w-5 h-5" />, color: 'text-yellow-600' },
  }

  return typeMap[ext] || { type: '未知文件', icon: <File className="w-5 h-5" />, color: 'text-gray-400' }
}

// Check if file can be previewed
function canPreviewFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const previewableTypes = [
    'pdf', 'txt', 'md', 'json', 'py', 'java', 'js', 'ts', 'c', 'cpp', 'h',
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
    'mp4', 'avi', 'mov', 'mp3', 'wav'
  ]
  return previewableTypes.includes(ext)
}

export function FilePreviewModal({ isOpen, onClose, fileName, fileUrl, fileSize, canDownload = true }: FilePreviewModalProps) {
  const [content, setContent] = React.useState<string>('')
  const [pdfImages, setPdfImages] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string>('')

  const fileInfo = getFileTypeInfo(fileName)
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const isPreviewable = canPreviewFile(fileName)

  // Load file content when modal opens
  React.useEffect(() => {
    if (!isOpen || !isPreviewable) return

    setLoading(true)
    setError('')
    setContent('')
    setPdfImages([])

    const loadContent = async () => {
      try {
        if (ext === 'pdf') {
          // For PDF, get both text content and images
          const [textContent, pdfBlob] = await Promise.all([
            fetchFileContent(fileUrl, fileName),
            fetchPdfBlob(fileUrl)
          ])
          setContent(textContent)

          if (pdfBlob) {
            const images = await convertPdfToImages(pdfBlob)
            setPdfImages(images)
          }
        } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
          // For images, just set the URL as content
          setContent(fileUrl)
        } else if (['mp4', 'avi', 'mov', 'mp3', 'wav'].includes(ext)) {
          // For media files, set URL as content
          setContent(fileUrl)
        } else {
          // For text files
          const textContent = await fetchFileContent(fileUrl, fileName)
          setContent(textContent)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载文件失败')
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [isOpen, fileUrl, fileName, ext, isPreviewable])

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={fileInfo.color}>
              {fileInfo.icon}
            </div>
            <div>
              <h3 className="font-semibold text-lg break-all">{fileName}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{fileInfo.type}</span>
                {fileSize && (
                  <>
                    <span>•</span>
                    <span>{fileSize}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDownload && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="gap-1.5"
              >
                <a
                  href={fileUrl}
                  download={fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-4 h-4" />
                  下载
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {!isPreviewable ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <File className="w-16 h-16 text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">无法预览此文件类型</h4>
              <p className="text-muted-foreground mb-4">
                {fileInfo.type} 文件不支持在线预览，请下载后查看
              </p>
              {canDownload && (
                <Button asChild>
                  <a
                    href={fileUrl}
                    download={fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载文件
                  </a>
                </Button>
              )}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">正在加载预览...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-destructive mb-4">
                <X className="w-16 h-16 mx-auto mb-2" />
                <h4 className="text-lg font-medium">预览失败</h4>
              </div>
              <p className="text-muted-foreground mb-4">{error}</p>
              {canDownload && (
                <Button asChild variant="outline">
                  <a
                    href={fileUrl}
                    download={fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载文件
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* PDF Preview */}
              {ext === 'pdf' && (
                <div className="space-y-6">
                  {pdfImages.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">PDF页面预览</h4>
                      <div className="space-y-4">
                        {pdfImages.map((imageUrl, index) => (
                          <div key={index} className="border border-border rounded-lg overflow-hidden">
                            <div className="bg-muted px-3 py-2 text-sm font-medium">
                              第 {index + 1} 页
                            </div>
                            <div className="p-4 bg-white">
                              <img
                                src={imageUrl}
                                alt={`PDF第${index + 1}页`}
                                className="max-w-full h-auto mx-auto shadow-sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {content && !content.startsWith('[') && (
                    <div>
                      <h4 className="font-medium mb-3">文本内容</h4>
                      <div className="bg-muted rounded-lg p-4">
                        <pre className="whitespace-pre-wrap text-sm font-mono overflow-auto max-h-96">
                          {content}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Image Preview */}
              {['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) && (
                <div className="text-center">
                  <img
                    src={content}
                    alt={fileName}
                    className="max-w-full max-h-[60vh] mx-auto rounded-lg shadow-sm"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      setError('图片加载失败')
                    }}
                  />
                </div>
              )}

              {/* Video Preview */}
              {['mp4', 'avi', 'mov'].includes(ext) && (
                <div className="text-center">
                  <video
                    src={content}
                    controls
                    className="max-w-full max-h-[60vh] mx-auto rounded-lg shadow-sm"
                    onError={() => setError('视频加载失败')}
                  >
                    您的浏览器不支持视频播放
                  </video>
                </div>
              )}

              {/* Audio Preview */}
              {['mp3', 'wav'].includes(ext) && (
                <div className="text-center">
                  <div className="inline-flex flex-col items-center gap-4 p-8 bg-muted rounded-lg">
                    <Music className="w-16 h-16 text-muted-foreground" />
                    <audio
                      src={content}
                      controls
                      className="w-full max-w-md"
                      onError={() => setError('音频加载失败')}
                    >
                      您的浏览器不支持音频播放
                    </audio>
                  </div>
                </div>
              )}

              {/* Text Preview */}
              {['txt', 'md', 'json', 'py', 'java', 'js', 'ts', 'c', 'cpp', 'h'].includes(ext) && content && (
                <div>
                  <h4 className="font-medium mb-3">文件内容</h4>
                  <div className="bg-muted rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm font-mono overflow-auto max-h-96">
                      {content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // Use portal to render modal at document body level
  return createPortal(modalContent, document.body)
}