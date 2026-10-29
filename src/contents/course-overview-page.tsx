import type { PlasmoCSConfig } from "plasmo"

import { courseOverviewBeautifier } from "@/features/courses/course-overview-beautifier"
import { createBeautifierInjector } from "@/shared/content-scripts/create-beautifier-injector"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/content*"],
  css: ["../styles/global.css", "../styles/course-detail.css"],
  run_at: "document_end"
}

const CourseOverviewPageInjector = createBeautifierInjector({
  pageName: "course overview page",
  beautify: courseOverviewBeautifier
})

export default CourseOverviewPageInjector
