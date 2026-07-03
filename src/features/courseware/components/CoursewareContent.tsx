import * as React from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { CoursewareFileItem } from "./CoursewareFileItem"
import type { ProcessedCoursewareSection } from "@/types"

interface CoursewareContentProps {
  section: ProcessedCoursewareSection
  downloading?: boolean
  downloadDisabled?: boolean
  downloadProgress?: string
  selectedFileIds?: ReadonlySet<number>
  onFileSelectionChange?: (fileId: number, selected: boolean) => void
  onDownloadSection?: () => void
}

export function CoursewareContent({
  section,
  downloading = false,
  downloadDisabled = false,
  downloadProgress,
  selectedFileIds,
  onFileSelectionChange,
  onDownloadSection
}: CoursewareContentProps) {
  const downloadableCount = section.files.filter((file) => file.canDownload).length

  return (
    <div className="flex flex-col gap-3">
      {section.files.length > 0 ? (
        <>
          {onDownloadSection && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/70 p-3">
              <span className="text-sm text-muted-foreground">
                可下载 {downloadableCount} 个文件
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  downloadDisabled || downloading || downloadableCount === 0
                }
                onClick={onDownloadSection}>
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  {downloading ? downloadProgress || "打包中..." : "下载本章"}
                </span>
              </Button>
            </div>
          )}
          {section.files.map((file) => (
            <CoursewareFileItem
              key={file.id}
              file={file}
              isSelected={selectedFileIds?.has(file.id) ?? false}
              onSelectedChange={onFileSelectionChange}
            />
          ))}
        </>
      ) : (
        <p className="text-muted-foreground text-sm py-4">该章节暂无课件</p>
      )}
    </div>
  )
}
