import type { PlasmoCSConfig } from "plasmo"
import { useStorage } from "@plasmohq/storage/hook"
import { useEffect, useRef } from "react"

import { coursePageBeautifier } from "../lib/coursePageBeautifier"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/user/courses*"],
  css: ["../styles/global.css", "../styles/coursePage.css"],
  run_at: "document_end"
}

const CoursePageInjector = () => {
  const [theme] = useStorage("theme", "light")
  const rootClassName = "xzzdpro"
  const isBeautifying = useRef(false)

  useEffect(() => {
    const rootElement = document.documentElement
    rootElement.classList.add(rootClassName)
    rootElement.setAttribute("data-theme", theme)

    // check if already beautified
    if (document.querySelector('.xzzdpro-root')) {
      console.log('XZZDPRO: beautification already applied, skipping...')
      return
    }

    // prevent multiple beautification processes
    if (isBeautifying.current) {
      console.log('XZZDPRO: beautification in progress, skipping...')
      return
    }

    isBeautifying.current = true
    console.log('XZZDPRO: starting course page beautification...')

    coursePageBeautifier()
  }, [theme])

  return null
}

export default CoursePageInjector
