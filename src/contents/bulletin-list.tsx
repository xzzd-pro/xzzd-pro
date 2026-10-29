import type { PlasmoCSConfig } from "plasmo"

import { bulletinListBeautifier } from "@/features/bulletin/bulletin-list-beautifier"
import { createBeautifierInjector } from "@/shared/content-scripts/create-beautifier-injector"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/bulletin-list*"],
  css: ["../styles/global.css", "../styles/bulletin-list.css"],
  run_at: "document_end"
}

const NotificationPageInjector = createBeautifierInjector({
  pageName: "bulletin list",
  beautify: bulletinListBeautifier
})

export default NotificationPageInjector
