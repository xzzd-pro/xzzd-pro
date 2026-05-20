import { storage } from "@/lib/storage"
import {
  applyThemeToDocument,
  bootstrapStoredTheme,
  normalizeTheme
} from "@/lib/themeDom"
import { useEffect, useRef } from "react"

import { useStorage } from "@plasmohq/storage/hook"

bootstrapStoredTheme(storage)

type Beautifier = () => void | Promise<void>

interface CreateBeautifierInjectorOptions {
  pageName: string
  beautify: Beautifier
  shouldSkip?: () => boolean
}

const rootClassName = "xzzdpro"
const rootSelector = ".xzzdpro-root"

function disableBeautification() {
  const rootElement = document.documentElement

  rootElement.classList.remove(rootClassName)
  rootElement.classList.remove("dark")
  rootElement.removeAttribute("data-theme")
  rootElement.style.removeProperty("color-scheme")

  document.body?.removeAttribute("data-theme")
  document.body?.classList.add("xzzdpro-disabled")
}

export function createBeautifierInjector({
  pageName,
  beautify,
  shouldSkip
}: CreateBeautifierInjectorOptions) {
  const BeautifierInjector = () => {
    const [theme] = useStorage(
      {
        key: "theme",
        instance: storage
      },
      "light"
    )
    const [beautifyEnabled, , { isLoading }] = useStorage<boolean>(
      {
        key: "beautify-enabled",
        instance: storage
      },
      true
    )
    const isBeautifying = useRef(false)

    useEffect(() => {
      if (shouldSkip?.()) return

      if (isLoading) {
        console.log("XZZDPRO: Waiting for storage to load...")
        return
      }

      const rootElement = document.documentElement
      rootElement.classList.add(rootClassName)
      applyThemeToDocument(normalizeTheme(theme))

      if (beautifyEnabled === false) {
        console.log("XZZDPRO: beautification is disabled")
        disableBeautification()
        return
      }

      document.body?.classList.remove("xzzdpro-disabled")

      if (document.querySelector(rootSelector)) {
        console.log("XZZDPRO: beautification already applied, skipping...")
        return
      }

      if (isBeautifying.current) {
        console.log("XZZDPRO: beautification in progress, skipping...")
        return
      }

      isBeautifying.current = true
      console.log(`XZZDPRO: starting ${pageName} beautification...`)

      Promise.resolve(beautify()).catch((error) => {
        isBeautifying.current = false
        console.error(`XZZDPRO: failed to beautify ${pageName}`, error)
      })
    }, [beautify, beautifyEnabled, isLoading, pageName, shouldSkip, theme])

    return null
  }

  BeautifierInjector.displayName = "BeautifierInjector"

  return BeautifierInjector
}
