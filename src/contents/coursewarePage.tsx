import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"
import type { PlasmoCSConfig } from "plasmo"

import { coursewareBeautifier } from "@/features/courseware/coursewareBeautifier"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/courseware*"],
  css: ["../styles/global.css", "../styles/courseDetail.css"],
  run_at: "document_end"
}

const CoursewarePageInjector = createBeautifierInjector({
  pageName: "courseware page",
  beautify: coursewareBeautifier
})

export default CoursewarePageInjector
