import type { PlasmoCSConfig } from "plasmo"

import { courseOverviewBeautifier } from "@/features/courses/courseOverviewBeautifier"
import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/content*"],
  css: ["../styles/global.css", "../styles/courseDetail.css"],
  run_at: "document_end"
}

const CourseOverviewPageInjector = createBeautifierInjector({
  pageName: "course overview page",
  beautify: courseOverviewBeautifier
})

export default CourseOverviewPageInjector
