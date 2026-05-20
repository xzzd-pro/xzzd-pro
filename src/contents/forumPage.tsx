import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"
import type { PlasmoCSConfig } from "plasmo"

import { forumBeautifier } from "@/features/forum/forumBeautifier"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/forum*"],
  css: ["../styles/global.css", "../styles/courseDetail.css"],
  run_at: "document_end"
}

const ForumPageInjector = createBeautifierInjector({
  pageName: "forum page",
  beautify: forumBeautifier
})

export default ForumPageInjector
