import { useStorage } from "@plasmohq/storage/hook"
import { storage } from "@/lib/storage"
import { Switch } from "@/components/ui/switch"
import { useEffect } from "react"
import "../styles/global.css"

function IndexPopup() {
  const [beautifyEnabled, setBeautifyEnabled] = useStorage({
    key: "beautify-enabled",
    instance: storage
  }, true)

  useEffect(() => {
    console.log('XZZDPRO Popup: beautifyEnabled =', beautifyEnabled)
  }, [beautifyEnabled])

  const handleToggle = (checked: boolean) => {
    console.log('XZZDPRO Popup: 切换美化功能为:', checked)
    setBeautifyEnabled(checked)
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

        <div className="text-xs text-muted-foreground pt-4 border-t">
          <p>💡 更改设置后需要刷新页面才能生效</p>
          <p className="mt-2">调试: beautifyEnabled = {String(beautifyEnabled)}</p>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup