import type { PlasmoCSConfig } from "plasmo"

import { coursePageBeautifier } from "@/features/courses/course-page-beautifier"
import { createBeautifierInjector } from "@/shared/content-scripts/create-beautifier-injector"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/user/courses*"],
  css: ["../styles/global.css", "../styles/course-page.css"],
  run_at: "document_end"
}

const CoursePageInjector = createBeautifierInjector({
  pageName: "course page",
  beautify: coursePageBeautifier
})

export default CoursePageInjector
