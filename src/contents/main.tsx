import type { PlasmoCSConfig } from "plasmo"
import { useStorage } from "@plasmohq/storage/hook"
import { useEffect, useRef } from "react"

import { indexPageBeautifier } from "../lib/indexPageBeautifier"
import { waitForElement } from "../lib/waitForElement"

export const config: PlasmoCSConfig = {
  matches: ["https://courses.zju.edu.cn/*"],
  css: ["../styles/main.css"],
  run_at: "document_end"
}

const ThemeInjector = () => {
  const [theme] = useStorage("theme", "light")
  const rootClassName = "xzzdpro"
  const isBeautifying = useRef(false)  

  useEffect(() => {
    const rootElement = document.documentElement
    rootElement.classList.add(rootClassName)
    rootElement.setAttribute("data-theme", theme)

    const pathname = window.location.pathname;

    if (pathname === '/' || pathname.startsWith('/user/index')) {
      // check if already beautified
      if (document.querySelector('.xzzdpro-root')) {
        console.log('XZZDPRO: beautification already applied, skipping...');
        return;
      }
      // prevent multiple beautification processes
      if (isBeautifying.current) {
        console.log('XZZDPRO: beautification in progress, skipping...');
        return;
      }

      isBeautifying.current = true;
      console.log('XZZDPRO: starting beautification...');

      waitForElement('#userCurrentName', 10000)
        .then(() => {
          return waitForElement('.todo-list-list', 3000).catch(() => {
            console.log('XZZDPRO: unable to find .todo-list-list, skipping...');
            return null;
          });
        })
        .then(() => {
          indexPageBeautifier();
        })
        .catch((error) => {
          console.error('XZZDPRO: failed to wait for elements:', error);
          console.log('XZZDPRO: trying to beautify anyway...');
          indexPageBeautifier();
        });
    }
  }, [theme])

  return null
}

export default ThemeInjector