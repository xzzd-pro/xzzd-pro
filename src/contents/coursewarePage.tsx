import type { PlasmoCSConfig } from "plasmo"
import { useStorage } from "@plasmohq/storage/hook"
import { useEffect, useRef } from "react"

import { coursewareBeautifier } from "../lib/coursewareBeautifier"
import { storage } from "@/lib/storage"
import { applyThemeToDocument, bootstrapStoredTheme, normalizeTheme } from "@/lib/themeDom"

// Apply theme ASAP to reduce the "light flash" before storage finishes loading.
bootstrapStoredTheme(storage)

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/course/*/courseware*"],
  css: ["../styles/global.css", "../styles/courseDetail.css"],
  run_at: "document_end"
}

const CoursewarePageInjector = () => {
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
    applyThemeToDocument(normalizeTheme(theme))

    if (beautifyEnabled === false) {
      console.log('XZZDPRO: beautification is disabled')
      rootElement.classList.remove(rootClassName)
      rootElement.removeAttribute("data-theme")
      rootElement.classList.remove("dark")
      rootElement.style.removeProperty("color-scheme")
      document.body?.removeAttribute("data-theme")
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
    console.log('XZZDPRO: starting courseware page beautification...')

    void coursewareBeautifier()
  }, [theme, beautifyEnabled, isLoading])

  return null
}

export default CoursewarePageInjector
