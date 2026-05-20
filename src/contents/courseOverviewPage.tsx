import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"
import type { PlasmoCSConfig } from "plasmo"

import { courseOverviewBeautifier } from "@/features/courses/courseOverviewBeautifier"

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
