import type { PlasmoCSConfig } from "plasmo"
import { useStorage } from "@plasmohq/storage/hook"
import { storage } from "@/lib/storage"
import { useEffect, useRef, useState } from "react"

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
    // Wait for storage to load
    if (isLoading) {
      console.log('XZZDPRO: Waiting for storage to load...')
      return
    }

    console.log('XZZDPRO: beautifyEnabled =', beautifyEnabled, 'type:', typeof beautifyEnabled)

    const rootElement = document.documentElement
    rootElement.classList.add(rootClassName)
    rootElement.setAttribute("data-theme", theme)

    // check if beautification is disabled
    if (beautifyEnabled === false) {
      console.log('XZZDPRO: beautification is disabled')
      return
    }

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
  }, [theme, beautifyEnabled, isLoading])

  return null
}

export default IndexPageInjector
