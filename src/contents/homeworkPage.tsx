import type { PlasmoCSConfig } from "plasmo"

import { homeworkBeautifier } from "@/features/homework/homeworkBeautifier"
import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/homework*"],
  css: ["../styles/global.css", "../styles/courseDetail.css"],
  run_at: "document_end"
}

const HomeworkPageInjector = createBeautifierInjector({
  pageName: "homework page",
  beautify: homeworkBeautifier
})

export default HomeworkPageInjector
