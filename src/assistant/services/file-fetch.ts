import { sendToBackground } from "@plasmohq/messaging"

interface FetchFileResponse {
  dataUri?: string
  error?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Downloads a file from the course site, retrying through the background script when the page cannot fetch it directly.
 * @param url File URL.
 * @returns The file contents.
 * @throws If access is denied or both attempts fail.
 */
export async function fetchBlob(url: string): Promise<Blob> {
  let directError: unknown
  try {
    const response = await fetch(url, { credentials: "include" })
    if (response.status === 401 || response.status === 403) {
      throw Object.assign(
        new Error(
          `文件访问被拒绝（HTTP ${response.status}），请在学在浙大原生页面查看。`
        ),
        { denied: true }
      )
    }
    if (!response.ok)
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    return await response.blob()
  } catch (error) {
    if (error && typeof error === "object" && "denied" in error) throw error
    directError = error
  }

  // Cross-origin file redirects can require extension permissions. A successful
  // background fallback is normal recovery, not an extension warning.
  try {
    const result = (await sendToBackground({
      name: "fetch-file",
      body: { url }
    } as any)) as FetchFileResponse | undefined
    if (result?.error) throw new Error(result.error)
    if (!result?.dataUri) throw new Error("后台未返回文件数据")
    const response = await fetch(result.dataUri)
    if (!response.ok)
      throw new Error(`读取后台文件数据失败：HTTP ${response.status}`)
    return await response.blob()
  } catch (error) {
    throw new Error(
      `文件读取失败；页面请求：${errorMessage(directError)}；后台请求：${errorMessage(error)}`
    )
  }
}
