/** A failed request to the course site, with its HTTP status when there was one. */
export class LoadError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = "LoadError"
  }
}

/**
 * Turns a load failure into a short message telling the user what went wrong
 * and what to try.
 * @param error What the load threw.
 * @param subject What was being loaded, e.g. "公告" or "课程".
 * @returns The message to show next to a retry button.
 */
export function describeLoadError(error: unknown, subject: string): string {
  if (error instanceof LoadError) {
    if (error.status === 401 || error.status === 403) {
      return `${subject}加载失败：登录已失效，请重新登录学在浙大后重试。`
    }
    if (error.status !== undefined) {
      return `${subject}加载失败（HTTP ${error.status}），请稍后重试。`
    }
    return `${subject}加载失败：${error.message}`
  }
  // fetch rejects with a TypeError when the request never reaches the server.
  if (error instanceof TypeError) {
    return `${subject}加载失败：无法连接学在浙大，请检查网络后重试。`
  }
  return `${subject}加载失败，请稍后重试。`
}
