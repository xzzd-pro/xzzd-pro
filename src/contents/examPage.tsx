import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"
import type { PlasmoCSConfig } from "plasmo"

import { examBeautifier } from "@/features/exam/examBeautifier"

export const config: PlasmoCSConfig = {
  //  abolished
  matches: ["https://courses.zju.edu.cn/course/*/exam1111*"],
  css: ["../styles/global.css", "../styles/courseDetail.css"],
  run_at: "document_end"
}

const ExamPageInjector = createBeautifierInjector({
  pageName: "exam page",
  beautify: examBeautifier
})

export default ExamPageInjector
