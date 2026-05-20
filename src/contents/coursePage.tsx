import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"
import type { PlasmoCSConfig } from "plasmo"

import { coursePageBeautifier } from "@/features/courses/coursePageBeautifier"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/user/courses*"],
  css: ["../styles/global.css", "../styles/coursePage.css"],
  run_at: "document_end"
}

const CoursePageInjector = createBeautifierInjector({
  pageName: "course page",
  beautify: coursePageBeautifier
})

export default CoursePageInjector
