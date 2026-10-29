import { Eye, Loader2 } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { fetchNativePreviewUrl } from "@/lib/nativePreview"

export function NativePreviewButton({
  fileUrl,
  activityUrl
}: {
  fileUrl: string
  activityUrl: string
}) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState("")
  const inFlight = React.useRef(false)

  const openPreview = async () => {
    if (inFlight.current) return
    // Reserve the tab during the click so async fetching does not trigger popup blocking.
    const tab = window.open("about:blank", "_blank")
    if (!tab) {
      setError("浏览器拦截了新标签页，请允许弹出窗口后重试。")
      return
    }
    tab.opener = null
    inFlight.current = true
    setPending(true)
    setError("")
    try {
      const url = await fetchNativePreviewUrl(fileUrl, activityUrl)
      if (!tab.closed) tab.location.replace(url)
    } catch (cause) {
      if (!tab.closed) tab.close()
      setError(
        cause instanceof Error ? cause.message : "申请原生预览失败，请重试。"
      )
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <div className="flex max-w-xs flex-col items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 bg-transparent text-foreground"
        disabled={pending}
        onClick={openPreview}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
        <span>{pending ? "正在打开…" : "原生预览"}</span>
      </Button>
      {error && (
        <div role="alert" className="text-xs text-muted-foreground">
          {error}{" "}
          <a
            className="underline"
            href={activityUrl}
            target="_blank"
            rel="noopener noreferrer">
            打开原生页面
          </a>
        </div>
      )}
    </div>
  )
}
