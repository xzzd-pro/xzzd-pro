import type { PlasmoCSConfig } from "plasmo"
import { useStorage } from "@plasmohq/storage/hook"
import { useEffect, useRef } from "react"

import { examBeautifier } from "../lib/examBeautifier"
import { storage } from "@/lib/storage"

export const config: PlasmoCSConfig = {
  //  abolished
  matches: ["https://courses.zju.edu.cn/course/*/exam1111*"],
  css: ["../styles/global.css", "../styles/courseDetail.css"],
  run_at: "document_end"
}

const ExamPageInjector = () => {
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
    console.log('XZZDPRO: starting exam page beautification...')

    void examBeautifier()
  }, [theme, beautifyEnabled, isLoading])

  return null
}

export default ExamPageInjector
