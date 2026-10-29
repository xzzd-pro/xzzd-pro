import type { PlasmoCSConfig } from "plasmo"

import { scoreBoardBeautifier } from "@/features/score-board/score-board-beautifier"
import { createBeautifierInjector } from "@/shared/content-scripts/create-beautifier-injector"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/score*"],
  css: ["../styles/global.css", "../styles/course-detail.css"],
  run_at: "document_end"
}

const ScoreBoardPageInjector = createBeautifierInjector({
  pageName: "score board page",
  beautify: scoreBoardBeautifier
})

export default ScoreBoardPageInjector
