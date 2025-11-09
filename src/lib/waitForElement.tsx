// lib/waitForElement.ts

export function waitForElement(
  selector: string,
  timeout: number = 10000
): Promise<Element> {
  return new Promise((resolve, reject) => {
    // check if already exists
    const existingElement = document.querySelector(selector);
    if (existingElement && existingElement.textContent.trim().length > 0) {
      console.log(`XZZDPRO: element ${selector} already exists`);
      resolve(existingElement);
      return;
    }

    console.log(`XZZDPRO: waiting for element ${selector} ...`);

    // setTimeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`waiting for element ${selector} timed out (${timeout}ms)`));
    }, timeout);

    // create MutationObserver
    const observer = new MutationObserver((mutations) => {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 0) {
        console.log(`XZZDPRO: 检测到元素 ${selector} 已加载`);
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(element);
      }
    });

    // start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

export function waitForElements(
  selectors: string[],
  timeout: number = 10000
): Promise<Element[]> {
  return Promise.all(selectors.map(selector => waitForElement(selector, timeout)));
}
