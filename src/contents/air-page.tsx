import type { PlasmoCSConfig } from "plasmo"
import { useEffect } from "react"

import { useStorage } from "@plasmohq/storage/hook"

import { mountAirPage } from "@/features/air/air-page-beautifier"
import { loadBrandFont } from "@/lib/font-loader"
import { storage } from "@/lib/storage"
import { useBeautifierInitialization } from "@/shared/content-scripts/use-beautifier-initialization"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/air*"],
  css: ["../styles/global.css"],
  run_at: "document_end"
}

void loadBrandFont()

const AirPageInjector = () => {
  const [beautifyEnabled, , { isLoading }] = useStorage(
    {
      key: "beautify-enabled",
      instance: storage
    },
    true
  )

  useBeautifierInitialization({
    pageName: "Air Page",
    beautify: mountAirPage,
    enabled: !isLoading && beautifyEnabled !== false,
    waitForDom: true
  })

  useEffect(() => {
    if (isLoading) return

    if (beautifyEnabled === false) {
      console.log("XZZDPRO: beautification is disabled")
      document.body?.classList.add("xzzdpro-disabled")
      return
    }

    document.body?.classList.remove("xzzdpro-disabled")
  }, [beautifyEnabled, isLoading])

  return null
}

export default AirPageInjector
