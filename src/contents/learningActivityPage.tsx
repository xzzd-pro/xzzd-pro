import type { PlasmoCSConfig } from "plasmo"
import { useStorage } from "@plasmohq/storage/hook"
import { useEffect, useRef } from "react"

import { homeworkBeautifier } from "../lib/homeworkBeautifier"
import { coursewareBeautifier } from "../lib/coursewareBeautifier"
import { getUserId, detectActivityType, getActivityIdFromUrl } from "../lib/components/courseDetailHelpers"
import { storage } from "@/lib/storage"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/learning-activity*"],
  exclude_matches: ["https://courses.zju.edu.cn/course/*/learning-activity#/exam*"],
  css: ["../styles/global.css", "../styles/courseDetail.css"],
  run_at: "document_end"
}

const LearningActivityPageInjector = () => {
  const [theme] = useStorage({
    key: "theme",
    instance: storage
  }, "light")
  const [beautifyEnabled, , { isLoading }] = useStorage({
    key: "beautify-enabled",
    instance: storage
  }, true)
  const rootClassName = "xzzdpro"
  const isBeautifying = useRef(false)

  useEffect(() => {
    if (isLoading) return

    const rootElement = document.documentElement
    rootElement.classList.add(rootClassName)
    rootElement.setAttribute("data-theme", theme)

    if (beautifyEnabled === false) {
      console.log('XZZDPRO: beautification is disabled')
      document.body.classList.add('xzzdpro-disabled')
      return
    }

    if (document.querySelector('.xzzdpro-root')) {
      console.log('XZZDPRO: beautification already applied, skipping...')
      return
    }

    if (isBeautifying.current) {
      console.log('XZZDPRO: beautification in progress, skipping...')
      return
    }

    isBeautifying.current = true
    console.log('XZZDPRO: starting learning activity page beautification...')

    // Detect activity type and call appropriate beautifier
    const detectAndBeautify = async () => {
      const activityId = getActivityIdFromUrl()

      if (!activityId) {
        console.error('XZZDPRO: 无法提取活动ID')
        return
      }

      const userId = await getUserId()
      if (!userId) {
        console.error('XZZDPRO: 无法获取用户ID')
        return
      }

      const activityType = await detectActivityType(activityId, userId)
      console.log('XZZDPRO: 检测到活动类型:', activityType)

      if (activityType === 'courseware') {
        void coursewareBeautifier()
      } else if (activityType === 'homework') {
        void homeworkBeautifier()
      } else {
        console.error('XZZDPRO: 未知的活动类型')
      }
    }

    detectAndBeautify()
  }, [theme, beautifyEnabled, isLoading])

  return null
}

export default LearningActivityPageInjector
