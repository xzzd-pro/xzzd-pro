import type { PlasmoCSConfig } from "plasmo"

import { coursewareBeautifier } from "@/features/courseware/courseware-beautifier"
import { createBeautifierInjector } from "@/shared/content-scripts/create-beautifier-injector"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/courseware*"],
  css: ["../styles/global.css", "../styles/course-detail.css"],
  run_at: "document_end"
}

const CoursewarePageInjector = createBeautifierInjector({
  pageName: "courseware page",
  beautify: coursewareBeautifier
})

export default CoursewarePageInjector
