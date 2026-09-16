import { storage } from "@/lib/storage"
import {
  applyThemeToDocument,
  bootstrapStoredTheme,
  normalizeTheme
} from "@/lib/themeDom"
import { useEffect } from "react"

import { useStorage } from "@plasmohq/storage/hook"

import { useBeautifierInitialization } from "./useBeautifierInitialization"

bootstrapStoredTheme(storage)

type Beautifier = () => void | Promise<void>

interface CreateBeautifierInjectorOptions {
  pageName: string
  beautify: Beautifier
  shouldSkip?: () => boolean
}

const rootClassName = "xzzdpro"

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
    useBeautifierInitialization({
      pageName,
      beautify,
      shouldSkip,
      enabled: !isLoading && beautifyEnabled !== false
    })

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
    }, [beautifyEnabled, isLoading, shouldSkip, theme])

    return null
  }

  BeautifierInjector.displayName = "BeautifierInjector"

  return BeautifierInjector
}
