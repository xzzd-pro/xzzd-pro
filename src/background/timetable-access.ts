export class TimetableRequestError extends Error {
  constructor(
    message: string,
    readonly code: "login_required" | "unavailable" | "invalid_response",
    readonly status?: number
  ) {
    super(message)
  }
}

/**
 * Checks whether a URL is the ZJU unified login page or the academic system's login page.
 * @param raw URL to check.
 * @returns True for a login page; false for anything else, including invalid URLs.
 */
export function isLoginUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return (
      (url.hostname === "zjuam.zju.edu.cn" &&
        url.pathname.startsWith("/cas/login")) ||
      (url.hostname === "zdbk.zju.edu.cn" &&
        url.pathname === "/jwglxt/xtgl/login_slogin.html")
    )
  } catch {
    return false
  }
}

/**
 * Throws a typed error when a timetable request was redirected to login or rejected.
 * @param response Response of the timetable request.
 * @throws TimetableRequestError with code "login_required", or "unavailable" (plus the HTTP status) for any other failure.
 */
export function checkTimetableResponse(response: Response): void {
  if (response.status === 401 || isLoginUrl(response.url)) {
    throw new TimetableRequestError("需要登录教务系统", "login_required")
  }
  if (!response.ok) {
    // 901 alone cannot identify the reason for the rejected request.
    throw new TimetableRequestError(
      response.status === 901
        ? "教务系统暂时拒绝访问（901），请在浏览器中确认教务系统是否可正常打开。"
        : `教务系统请求失败（${response.status}）`,
      "unavailable",
      response.status
    )
  }
}

export type LoginResult = "ok" | "login_required" | "unavailable"

/**
 * Tries to sign in to the academic system through the existing ZJU single sign-on session.
 * @returns "ok" when the SSO redirect landed on the academic system, "login_required" when the user must sign in, or "unavailable" on any other failure.
 */
export async function performBackgroundLogin(): Promise<LoginResult> {
  try {
    const response = await fetch(
      "https://zdbk.zju.edu.cn/jwglxt/xtgl/login_cxSsoLoginUrl.html",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest"
        },
        credentials: "include"
      }
    )
    if (!response.ok) return "unavailable"
    const data = await response.json()
    if (typeof data.ssologinurl !== "string") return "unavailable"
    const url = new URL(data.ssologinurl.replace(/\\\//g, "/"))
    if (url.protocol !== "https:" || url.hostname !== "zjuam.zju.edu.cn")
      return "unavailable"
    // Follow once: manual redirect responses can hide their status and location.
    const final = await fetch(url.href, {
      redirect: "follow",
      credentials: "include"
    })
    if (!final.ok) return "unavailable"
    if (isLoginUrl(final.url)) return "login_required"
    if (new URL(final.url).hostname !== "zdbk.zju.edu.cn") return "unavailable"
    return "ok" // The caller verifies the session with a timetable request.
  } catch {
    return "unavailable"
  }
}
