import type { PlasmoMessaging } from "@plasmohq/messaging"

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ""

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

// Only school-hosted files may be fetched with the user's cookies.
function isAllowedFileUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false
  try {
    const url = new URL(raw)
    return (
      url.protocol === "https:" &&
      (url.hostname === "zju.edu.cn" || url.hostname.endsWith(".zju.edu.cn"))
    )
  } catch {
    return false
  }
}

/**
 * Downloads a school-hosted file for a content script that cannot fetch it directly.
 * Request body: `{ url }`; only course-site URLs are allowed.
 * Responds with `{ dataUri, contentType }`, or `{ error }` if the URL is rejected or the download fails.
 */
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const { url } = req.body || {}

  if (!url) {
    res.send({ error: "No URL provided" })
    return
  }

  if (!isAllowedFileUrl(url)) {
    res.send({ error: "URL is not a school-hosted file" })
    return
  }

  try {
    const response = await fetch(url, {
      credentials: "include"
    })

    if (!response.ok) {
      res.send({
        error: `Fetch failed: ${response.status} ${response.statusText}`
      })
      return
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream"
    const dataUri = `data:${contentType};base64,${arrayBufferToBase64(
      await response.arrayBuffer()
    )}`

    res.send({
      dataUri,
      contentType
    })
  } catch (error) {
    res.send({
      error: `Background fetch failed: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}

export default handler
