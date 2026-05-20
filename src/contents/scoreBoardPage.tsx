import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"
import type { PlasmoCSConfig } from "plasmo"

import { scoreBoardBeautifier } from "@/features/score-board/scoreBoardBeautifier"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/score*"],
  css: ["../styles/global.css", "../styles/courseDetail.css"],
  run_at: "document_end"
}

const ScoreBoardPageInjector = createBeautifierInjector({
  pageName: "score board page",
  beautify: scoreBoardBeautifier
})

export default ScoreBoardPageInjector
