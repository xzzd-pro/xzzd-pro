import { createBeautifierInjector } from "@/shared/contentScripts/createBeautifierInjector"
import type { PlasmoCSConfig } from "plasmo"

import {
  detectActivityType,
  getActivityIdFromUrl,
  getUserId
} from "@/shared/course-detail/courseDetailHelpers"
import { coursewareBeautifier } from "@/features/courseware/coursewareBeautifier"
import { homeworkBeautifier } from "@/features/homework/homeworkBeautifier"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/learning-activity*"],
  exclude_matches: [
    "https://courses.zju.edu.cn/course/*/learning-activity#/exam*"
  ],
  css: ["../styles/global.css", "../styles/courseDetail.css"],
  run_at: "document_end"
}

// Match patterns do not include the URL hash (#...), so `exclude_matches` cannot
// reliably exclude `#/exam/...` routes. Preemptively disable our hiding CSS on
// exam routes to avoid blank pages.
if (window.location.hash.startsWith("#/exam")) {
  document.body?.classList.add("xzzdpro-disabled")
}

const LearningActivityPageInjector = createBeautifierInjector({
  pageName: "learning activity page",
  shouldSkip: () => {
    if (window.location.hash.startsWith("#/exam")) {
      console.log(
        "XZZDPRO: exam route detected, skipping learning-activity beautification"
      )
      document.body?.classList.add("xzzdpro-disabled")
      return true
    }

    return false
  },
  beautify: async () => {
    const activityId = getActivityIdFromUrl()

    if (!activityId) {
      console.error("XZZDPRO: 无法提取活动ID")
      return
    }

    const userId = await getUserId()
    if (!userId) {
      console.error("XZZDPRO: 无法获取用户ID")
      return
    }

    const activityType = await detectActivityType(activityId, userId)
    console.log("XZZDPRO: 检测到活动类型:", activityType)

    if (activityType === "courseware") {
      await coursewareBeautifier()
    } else if (activityType === "homework") {
      await homeworkBeautifier()
    } else {
      console.error("XZZDPRO: 未知的活动类型")
    }
  }
})

export default LearningActivityPageInjector
