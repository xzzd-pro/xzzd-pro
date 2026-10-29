import type { PlasmoCSConfig } from "plasmo"

import { indexPageBeautifier } from "@/features/home/index-page-beautifier"
import { createBeautifierInjector } from "@/shared/content-scripts/create-beautifier-injector"

export const config: PlasmoCSConfig = {
  matches: [
    "https://courses.zju.edu.cn/",
    "https://courses.zju.edu.cn/user/index*"
  ],
  css: ["../styles/global.css", "../styles/index-page.css"],
  run_at: "document_end"
}

const IndexPageInjector = createBeautifierInjector({
  pageName: "index page",
  beautify: indexPageBeautifier
})

export default IndexPageInjector
