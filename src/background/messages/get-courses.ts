import type { PlasmoMessaging } from "@plasmohq/messaging";

const API_URL = "https://zdbk.zju.edu.cn/jwglxt/kbcx/xskbcx_cxXsKb.html";
const DEFAULT_GNMKDM = "N253508";
const DEFAULT_STUDENT_ID = ""; // Removed for privacy

function getTermContext() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  let xn = "";
  let xqm = "";

  // ZJU Quarter System (Approximate)
  // Fall: Sept - Nov
  // Winter: Nov - Jan
  // Spring: Feb - Apr
  // Summer: Apr - Jun

  // Academic Year Calculation
  // If we are in Aug-Dec, academic year starts this year.
  // If we are in Jan-Jul, academic year started last year.

  let startYear = year;
  if (month < 8) {
    startYear = year - 1;
  }
  xn = `${startYear}-${startYear + 1}`;

  // Term Calculation
  // User provided: 1|秋, 1|冬.
  if (month >= 9 && month <= 11) {
    if (month === 11 && now.getDate() > 15) {
      xqm = "1|冬";
    } else if (month === 11) {
      xqm = "1|秋";
    } else {
      xqm = "1|秋";
    }
    if (month == 11) xqm = "1|冬";
  } else if (month == 12 || month == 1) {
    xqm = "1|冬";
  } else if (month >= 2 && month <= 4) {
    xqm = "1|春";
  } else if (month >= 5 && month <= 7) {
    xqm = "1|夏";
  } else {
    xqm = "1|秋";
  }
  const xqmmc = xqm.split("|")[1] || "";
  return { xn, xqm, xqmmc };
}

function buildForm(studentId: string): URLSearchParams {
  const { xn, xqm, xqmmc } = getTermContext();
  console.log(`XZZDPRO: Querying for Year ${xn}, Term ${xqm}`);

  const form = new URLSearchParams();
  form.set("xnm", xn);
  form.set("xqm", xqm);
  form.set("xqmmc", xqmmc);
  form.set("xxqf", "0");
  form.set("xsfs", "0");
  form.set("kzlx", "ck"); // Control Type: Check/View
  form.set("_search", "false");
  form.set("nd", Date.now().toString());
  form.set("queryModel.showCount", "15");
  form.set("queryModel.currentPage", "1");
  form.set("queryModel.sortName", "xkkh");
  form.set("queryModel.sortOrder", "asc");
  form.set("time", "0");
  form.set("gnmkdm", DEFAULT_GNMKDM);
  form.set("su", studentId);
  return form;
}

async function fetchTimetable(studentId: string) {
  console.log("XZZDPRO: Starting fetchTimetable...");
  const su = studentId || DEFAULT_STUDENT_ID;

  try {
    // Step 1: Set Context (cxSfkc)
    const { xn, xqm } = getTermContext();
    console.log(`XZZDPRO: Setting context to Year ${xn}, Term ${xqm}`);

    // User observed that '|' is NOT encoded in the captured request (e.g. "1|%E5%86%AC")
    // encodeURIComponent encodes '|' to '%7C', so we revert that specific char.
    const encodedXqm = encodeURIComponent(xqm).replace(/%7C/g, "|");

    const setContextUrl = `https://zdbk.zju.edu.cn/jwglxt/kbcx/xskbcx_cxSfkc.html?xn=${xn}&xqm=${encodedXqm}&gnmkdm=${DEFAULT_GNMKDM}&su=${su}`;
    await fetch(setContextUrl, { method: "POST", credentials: "include" });

    // Step 2: Get Data (cxXsKb)
    const form = buildForm(su);
    const response = await fetch(
      `${API_URL}?gnmkdm=${encodeURIComponent(DEFAULT_GNMKDM)}&layout=default&su=${encodeURIComponent(su)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: form.toString(),
        credentials: "include",
      }
    );

    console.log("XZZDPRO: === Fetch Debug Info ===");
    console.log("URL:", response.url);
    console.log("Status:", response.status, response.statusText);
    console.log("Redirected:", response.redirected);
    const headers: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      headers[key] = val;
    });
    console.log("Headers:", headers);

    if (!response.ok) {
      console.error(
        "XZZDPRO: Fetch failed",
        response.status,
        response.statusText
      );
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const text = await response.text();
    console.log("XZZDPRO: Raw response body:", text);

    try {
      const json = JSON.parse(text);
      console.log("XZZDPRO: Timetable received", json);
      return json;
    } catch (e) {
      console.error("XZZDPRO: Failed to parse JSON", e);
      // Don't throw here, just return null so we can trigger login flow
      return null;
    }
  } catch (error) {
    console.error("XZZDPRO: Error in fetchTimetable", error);
    throw error;
  }
}

// async function logCookies(url: string) {
//   if (!chrome.cookies) {
//     console.warn("XZZDPRO: chrome.cookies API is not available.")
//     return
//   }
//   try {
//     const cookies = await chrome.cookies.getAll({ url })
//     console.log(`XZZDPRO: Cookies for ${url}:`, cookies.map(c => `${c.name}=${c.value}`).join("; "))
//   } catch (e) {
//     console.warn("XZZDPRO: Failed to get cookies", e)
//   }
// }

async function performBackgroundLogin() {
  console.log("XZZDPRO: === Login Debug Info ===");
  console.log("XZZDPRO: Attempting background login...");
  // await logCookies("https://zdbk.zju.edu.cn")
  // await logCookies("https://zjuam.zju.edu.cn")

  try {
    // Step 0: Get the dynamic SSO URL from ZDBK backend
    // POST /jwglxt/xtgl/login_cxSsoLoginUrl.html
    console.log("XZZDPRO: Fetching dynamic SSO URL...");
    const ssoUrlRes = await fetch(
      "https://zdbk.zju.edu.cn/jwglxt/xtgl/login_cxSsoLoginUrl.html",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      }
    );

    if (!ssoUrlRes.ok) {
      console.error(
        "XZZDPRO: Failed to get SSO URL. Status:",
        ssoUrlRes.status
      );
      return false;
    }

    const ssoUrlJson = await ssoUrlRes.json();
    console.log("XZZDPRO: Got SSO URL JSON:", ssoUrlJson);

    // {"ssologinurl":"https://zjuam.zju.edu.cn/cas/login?service=...","status":"success"}
    let ssoUrl = ssoUrlJson.ssologinurl;
    if (!ssoUrl) {
      console.error("XZZDPRO: No ssologinurl in response");
      return false;
    }

    // Fix escaped slashes if needed (JSON.parse usually handles it, but just in case)
    ssoUrl = ssoUrl.replace(/\\\//g, "/");
    console.log("XZZDPRO: Requesting SSO URL (Manual Redirect):", ssoUrl);

    // Step 1: Hit SSO with manual redirect to see if we get 302
    const ssoRes = await fetch(ssoUrl, {
      redirect: "manual",
      credentials: "include",
    });

    console.log(`XZZDPRO: Status: ${ssoRes.status}`);

    if (ssoRes.status === 0) {
      console.error(
        "XZZDPRO: Login Failed! Got Status 0 (Opaque Response). This usually means a CORS/Permission issue."
      );
      console.log(
        "XZZDPRO: Trying fallback with redirect: 'follow' to inspect final URL..."
      );

      const followRes = await fetch(ssoUrl, {
        redirect: "follow",
        credentials: "include",
      });
      console.log("XZZDPRO: Fallback Result - Final URL:", followRes.url);
      // console.log("XZZDPRO: Fallback Result - Status:", followRes.status)

      // If we landed on login page, we are not logged in
      if (followRes.url.includes("zjuam.zju.edu.cn/cas/login")) {
        console.error(
          "XZZDPRO: We are on the ZJUAM login page. User is NOT logged in."
        );
        return false;
      }

      // If we landed on ZDBK login page with ticket, it means SSO worked but ZDBK didn't consume it?
      if (followRes.url.includes("ticket=")) {
        console.log(
          "XZZDPRO: Ticket found in URL. Attempting to consume it manually..."
        );
        // Try to fetch it again to force cookie set?
        await fetch(followRes.url, { credentials: "include" });
      }

      return true;
    }

    if (ssoRes.status === 200) {
      console.error(
        "XZZDPRO: Login Failed! Got 200 OK from SSO, which means we are NOT logged in (showing login page)."
      );
      console.log(
        "XZZDPRO: Please ensure you are logged into ZJUAM in the browser."
      );
      return false;
    }

    if (ssoRes.status === 302) {
      const ticketUrl = ssoRes.headers.get("location");
      console.log("XZZDPRO: Got 302 Redirect to:", ticketUrl);

      if (ticketUrl) {
        // Step 2: Follow the redirect to ZDBK to consume ticket
        console.log("XZZDPRO: Consuming Ticket...");
        const zdbkRes = await fetch(ticketUrl, {
          redirect: "manual",
          credentials: "include",
        });
        // console.log(`XZZDPRO: Status: ${zdbkRes.status}`)

        // ZDBK usually redirects again (302) to index or sets cookie
        if (zdbkRes.status === 302) {
          const finalUrl = zdbkRes.headers.get("location");
          console.log("XZZDPRO: Got 302 Redirect to:", finalUrl);

          // Step 3: Follow final redirect to establish session
          if (finalUrl) {
            await fetch(finalUrl, { credentials: "include" });
            console.log("XZZDPRO: Final redirect followed.");
          }
        } else if (zdbkRes.status === 200) {
          console.log(
            "XZZDPRO: Step 2 ended with 200 OK. Session should be established."
          );
        }
      }
    }

    // await logCookies("https://zdbk.zju.edu.cn")
    return true;
  } catch (e) {
    console.error("XZZDPRO: Background login failed", e);
    return false;
  }
}

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const studentId = req.body?.studentId;
  console.log("XZZDPRO: Handling get-courses message for student:", studentId);

  try {
    let data = null;
    try {
      data = await fetchTimetable(studentId);
    } catch (e) {
      console.warn("XZZDPRO: First fetch failed.", e);
    }

    // If data is null or failed
    if (!data) {
      console.log("XZZDPRO: Data is null. Trying background login...");

      const loginSuccess = await performBackgroundLogin();

      if (loginSuccess) {
        console.log("XZZDPRO: Background login successful! Retrying fetch...");
        try {
          data = await fetchTimetable(studentId);
        } catch (e) {
          console.warn("XZZDPRO: Fetch after login failed.", e);
        }
      } else {
        console.warn("XZZDPRO: Background login failed.");
      }
    }

    if (data) {
      res.send({ status: "ok", data });
    } else {
      // Explicitly tell frontend that login is required
      res.send({ status: "login_required" });
    }
  } catch (error) {
    res.send({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export default handler;
