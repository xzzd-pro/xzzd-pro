import { useStorage } from "@plasmohq/storage/hook"
import { storage } from "@/lib/storage"
import { Switch } from "@/components/ui/switch"
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react"
import "../styles/global.css"
import "../styles/popup.css"

class PopupErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("XZZDPRO Popup: 渲染失败", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-80 p-6 bg-background text-foreground">
          <p className="text-sm font-medium">插件设置加载失败</p>
          <p className="text-xs text-muted-foreground mt-2">
            请刷新扩展页面后重试
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

function PopupContent() {
  const [beautifyEnabled, setBeautifyEnabled] = useStorage({
    key: "beautify-enabled",
    instance: storage
  }, true)
  const [needsRefresh, setNeedsRefresh] = useState(false)

  const handleToggle = (checked: boolean) => {
    console.log('XZZDPRO Popup: 切换美化功能为:', checked)
    setBeautifyEnabled(checked)
    setNeedsRefresh(true)
  }

  return (
    <div className="w-80 p-6 bg-background">
      <div className="space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold text-foreground">XZZDPRO</h2>
          <p className="text-sm text-muted-foreground mt-1">浙大课程平台增强插件</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="beautify-toggle" className="text-sm font-medium text-foreground cursor-pointer">
                页面美化
              </label>
              <p className="text-xs text-muted-foreground">
                当前状态: {beautifyEnabled ? '已启用' : '已禁用'}
              </p>
            </div>
            <Switch
              id="beautify-toggle"
              checked={beautifyEnabled}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>

        {needsRefresh && (
          <div className="text-xs text-amber-600 pt-3 border-t border-amber-200 bg-amber-50 -mx-6 px-6 pb-3 -mb-6 rounded-b-lg">
            设置已保存，请刷新页面以生效
          </div>
        )}
        {!needsRefresh && (
          <div className="text-xs text-muted-foreground pt-4 border-t">
            更改设置后需要刷新页面才能生效
          </div>
        )}
      </div>
    </div>
  )
}

function IndexPopup() {
  return (
    <div className="xzzdpro">
      <PopupErrorBoundary>
        <PopupContent />
      </PopupErrorBoundary>
    </div>
  )
}

export default IndexPopup
