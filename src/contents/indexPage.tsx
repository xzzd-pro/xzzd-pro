import type { PlasmoCSConfig } from "plasmo"
import { useStorage } from "@plasmohq/storage/hook"
import { useEffect, useRef } from "react"

import { indexPageBeautifier } from "../lib/indexPageBeautifier"

export const config: PlasmoCSConfig = {
  matches: [
    "https://courses.zju.edu.cn/",
    "https://courses.zju.edu.cn/user/index*"
  ],
  css: ["../styles/global.css", "../styles/indexPage.css"],
  run_at: "document_end"
}

const IndexPageInjector = () => {
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
    console.log('XZZDPRO: starting index page beautification...')

    indexPageBeautifier()
  }, [theme])

  return null
}

export default IndexPageInjector
