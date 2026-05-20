import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"
import type { PlasmoCSConfig } from "plasmo"

import { indexPageBeautifier } from "@/features/home/indexPageBeautifier"

export const config: PlasmoCSConfig = {
  matches: [
    "https://courses.zju.edu.cn/",
    "https://courses.zju.edu.cn/user/index*"
  ],
  css: ["../styles/global.css", "../styles/indexPage.css"],
  run_at: "document_end"
}

const IndexPageInjector = createBeautifierInjector({
  pageName: "index page",
  beautify: indexPageBeautifier
})

export default IndexPageInjector
