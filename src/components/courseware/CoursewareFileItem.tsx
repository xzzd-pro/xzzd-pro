import * as React from "react"
import { cn } from "@/lib/utils"
import { Download, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilePreviewModal } from "@/components/ui/file-preview-modal"
import type { ProcessedCoursewareFile } from "@/types"

// Get file extension icon as JSX
function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  const svgProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    className: "w-full h-full"
  }

  const iconMap: Record<string, React.ReactNode> = {
    'pdf': (
      <svg {...svgProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <path d="M9 13h6"/>
        <path d="M9 17h6"/>
      </svg>
    ),
    'doc': (
      <svg {...svgProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <path d="M9 13h6"/>
        <path d="M9 17h3"/>
      </svg>
    ),
    'ppt': (
      <svg {...svgProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <rect x="8" y="12" width="8" height="6" rx="1"/>
      </svg>
    ),
    'xls': (
      <svg {...svgProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <path d="M8 13h8M8 17h8M12 13v8"/>
      </svg>
    ),
    'zip': (
      <svg {...svgProps}>
        <path d="M21 8v13H3V3h12l6 5z"/>
        <path d="M12 3v6h-2v2h2v2h-2v2h2v6"/>
      </svg>
    ),
    'mp4': (
      <svg {...svgProps}>
        <polygon points="5,3 19,12 5,21" fill="currentColor"/>
      </svg>
    ),
    'mp3': (
      <svg {...svgProps}>
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    ),
    'jpg': (
      <svg {...svgProps}>
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21,15 16,10 5,21"/>
      </svg>
    ),
  }

  // Aliases
  iconMap['docx'] = iconMap['doc']
  iconMap['pptx'] = iconMap['ppt']
  iconMap['xlsx'] = iconMap['xls']
  iconMap['rar'] = iconMap['zip']
  iconMap['jpeg'] = iconMap['jpg']
  iconMap['png'] = iconMap['jpg']

  return iconMap[ext] || (
    <svg {...svgProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
    </svg>
  )
}

interface CoursewareFileItemProps {
  file: ProcessedCoursewareFile
  className?: string
}

export function CoursewareFileItem({ file, className }: CoursewareFileItemProps) {
  const [showPreview, setShowPreview] = React.useState(false)

  return (
    <>
      <div className={cn(
        "flex items-center gap-4 p-4 bg-card rounded-lg transition-all duration-200",
        "hover:translate-x-1 hover:shadow-md",
        className
      )}>
        <div className="w-9 h-9 flex-shrink-0 text-primary">
          {getFileIcon(file.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-foreground mb-1 break-words leading-snug">
            {file.name}
          </div>
          <div className="text-[13px] text-muted-foreground">
            {file.sizeText}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="w-4 h-4" />
            <span>预览</span>
          </Button>
          {file.canDownload ? (
            <Button
              asChild
              size="sm"
              className="gap-1.5"
            >
              <a
                href={file.downloadUrl}
                download={file.name}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="w-4 h-4" />
                <span>下载</span>
              </a>
            </Button>
          ) : (
            <span className="px-4 py-2 bg-border text-muted-foreground rounded-md text-[13px] font-medium">
              不可下载
            </span>
          )}
        </div>
      </div>

      <FilePreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        fileName={file.name}
        fileUrl={file.downloadUrl}
        fileSize={file.sizeText}
        canDownload={file.canDownload}
      />
    </>
  )
}
