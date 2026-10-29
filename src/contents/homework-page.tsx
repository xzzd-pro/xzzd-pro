import type { PlasmoCSConfig } from "plasmo"

import { homeworkBeautifier } from "@/features/homework/homework-beautifier"
import { createBeautifierInjector } from "@/shared/content-scripts/create-beautifier-injector"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/homework*"],
  css: ["../styles/global.css", "../styles/course-detail.css"],
  run_at: "document_end"
}

const HomeworkPageInjector = createBeautifierInjector({
  pageName: "homework page",
  beautify: homeworkBeautifier
})

export default HomeworkPageInjector
