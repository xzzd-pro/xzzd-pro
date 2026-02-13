import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef } from "react"
import { mountAirPage } from "../lib/airPageBeautifier"

export const config: PlasmoCSConfig = {
    matches: ["https://courses.zju.edu.cn/air*"],
    css: ["../styles/global.css"],
    run_at: "document_end"
}

console.log("XZZDPRO: Air Page Content Script Loaded (Verified)")

const AirPageInjector = () => {
    const isMounted = useRef(false)

    useEffect(() => {
        if (isMounted.current) return
        isMounted.current = true

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
    }, [])

    return null
}

export default AirPageInjector
