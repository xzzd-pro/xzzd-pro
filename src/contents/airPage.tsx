import type { PlasmoCSConfig } from "plasmo"
import { useStorage } from "@plasmohq/storage/hook"
import { useEffect, useRef } from "react"
import { mountAirPage } from "../lib/airPageBeautifier"
import { storage } from "@/lib/storage"

export const config: PlasmoCSConfig = {
    matches: ["https://courses.zju.edu.cn/air*"],
    css: ["../styles/global.css"],
    run_at: "document_end"
}

console.log("XZZDPRO: Air Page Content Script Loaded (Verified)")

const AirPageInjector = () => {
    const [beautifyEnabled, , { isLoading }] = useStorage({
        key: "beautify-enabled",
        instance: storage
    }, true)
    const isMounted = useRef(false)

    useEffect(() => {
        if (isLoading) return

        if (isMounted.current) return
        isMounted.current = true

        if (beautifyEnabled === false) {
            console.log('XZZDPRO: beautification is disabled')
            return
        }

        const init = async () => {
            try {
                console.log("XZZDPRO: Mounting Full Page Assistant...")
                await mountAirPage()
                console.log("XZZDPRO: Assistant Mounted Successfully")
            } catch (error) {
                console.error("XZZDPRO: Failed to mount assistant", error)
            }
        }

        // Ensure DOM is ready (though run_at document_end usually suffices)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init)
        } else {
            init()
        }
    }, [beautifyEnabled, isLoading])

    return null
}

export default AirPageInjector
