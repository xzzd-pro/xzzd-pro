import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"
import type { PlasmoCSConfig } from "plasmo"

import { bulletinListBeautifier } from "@/features/bulletin/bulletinListBeautifier"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/bulletin-list*"],
  css: ["../styles/global.css", "../styles/bulletinList.css"],
  run_at: "document_end"
}

const NotificationPageInjector = createBeautifierInjector({
  pageName: "bulletin list",
  beautify: bulletinListBeautifier
})

export default NotificationPageInjector
