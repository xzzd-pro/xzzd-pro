// Run in the school WPS reader's DevTools context after the document is visible.
// Read-only: no network requests, scrolling, downloads, or document content collection.
;(() => {
  if (location.origin !== "https://course-wps.zju.edu.cn") {
    console.info(
      "请在学校 WPS 阅读器标签页运行；若阅读器嵌在页面中，请先选择 course-wps.zju.edu.cn 的 Console 执行上下文。"
    )
    return
  }
  const app = window.APP
  const number = (read) => {
    try {
      const value = read()
      return Number.isFinite(value) ? value : null
    } catch {
      return null
    }
  }
  const rect = (element) => {
    const r = element.getBoundingClientRect()
    return Object.fromEntries(
      ["x", "y", "width", "height"].map((key) => [
        key,
        Math.round(r[key] * 100) / 100
      ])
    )
  }
  const permission = (read) => {
    try {
      const value = read()
      return typeof value === "boolean" ? value : null
    } catch {
      return null
    }
  }
  const report = {
    readerDetected: !!app,
    originalTotalPages: number(() => app._docMeta.getTotalPageCount()),
    visiblePageCount: number(() => app._docMeta.getPageCount()),
    authorizedPages: number(() => app._docMeta.getAuthorityPageCount()),
    currentPage: number(() => app.currentPage),
    zoom: number(() => app.getZoom()),
    canNavigate: typeof app?.scrollToPage === "function",
    canFitPage: typeof app?.zoomTo === "function",
    permissions: {
      print: permission(() => app.canPrint()),
      download: permission(() => app.canDownload()),
      saveAs: permission(() => app.canSaveAs())
    },
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    mounts: [...document.querySelectorAll(".pdf-page-mount")].map(rect),
    pages: [...document.querySelectorAll(".pdf-page[data-id]")].map(
      (element) => ({
        index: element.getAttribute("data-id"),
        loaded: element.classList.contains("loaded"),
        loading: element.classList.contains("loading"),
        rect: rect(element),
        canvases: element.querySelectorAll("canvas").length,
        images: element.querySelectorAll("img").length
      })
    )
  }
  console.log(
    "XZZDPRO 预览结构诊断（不含正文、文件名或令牌）\n" +
      JSON.stringify(report, null, 2)
  )
  return report
})()
