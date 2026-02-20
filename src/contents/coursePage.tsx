import type { PlasmoCSConfig } from "plasmo"
import { useStorage } from "@plasmohq/storage/hook"
import { storage } from "@/lib/storage"
import { useEffect, useRef } from "react"

import { coursePageBeautifier } from "../lib/coursePageBeautifier"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/user/courses*"],
  css: ["../styles/global.css", "../styles/coursePage.css"],
  run_at: "document_end"
}

const CoursePageInjector = () => {
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
    console.log('XZZDPRO: starting course page beautification...')

    coursePageBeautifier()
  }, [theme, beautifyEnabled, isLoading])

  return null
}

export default CoursePageInjector
