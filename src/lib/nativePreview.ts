export function nativeActivityUrl(courseId: number | string, activityId: number | string): string {
  return `https://courses.zju.edu.cn/course/${encodeURIComponent(courseId)}/learning-activity?xzzdpro-native=1#/${encodeURIComponent(activityId)}`
}

export function isNativePreviewPage(url: string): boolean {
  return new URL(url).searchParams.get("xzzdpro-native") === "1"
}

export function nativeCurrentPageUrl(url: string): string {
  const parsed = new URL(url)
  parsed.searchParams.set("xzzdpro-native", "1")
  return parsed.href
}

// Request a fresh school-issued URL; preview links must not be cached.
export async function fetchNativePreviewUrl(fileUrl: string, activityUrl: string): Promise<string> {
  const file = new URL(fileUrl)
  const activity = new URL(activityUrl)
  const uploadId = file.pathname.match(/^\/api\/uploads\/(\d+)\/blob$/)?.[1]
  const activityId = activity.hash.match(/^#\/(\d+)(?:[/?]|$)/)?.[1]
  if (file.origin !== "https://courses.zju.edu.cn" ||
      activity.origin !== file.origin || !uploadId || !activityId) {
    throw new Error("无法确定文件所属的学习活动，请从原生页面查看。")
  }
  const params = new URLSearchParams({ preview: "true", refer_id: activityId, refer_type: "learning_activity" })
  const response = await fetch(`${file.origin}/api/uploads/${uploadId}/preview/private-wps?${params}`, {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  })
  if (!response.ok) throw new Error(`申请原生预览失败（HTTP ${response.status}）`)
  let data: { preview_url?: unknown }
  try { data = await response.json() } catch { throw new Error("学校未返回有效的预览地址，请确认登录状态。") }
  let preview: URL
  try {
    if (typeof data?.preview_url !== "string") throw new Error()
    preview = new URL(data.preview_url)
  } catch { throw new Error("学校未返回有效的预览地址。") }
  if (preview.origin !== "https://course-wps.zju.edu.cn" || preview.username || preview.password) {
    throw new Error("学校返回的预览地址不受支持，请从原生页面查看。")
  }
  return preview.href
}
