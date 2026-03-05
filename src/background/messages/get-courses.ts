import type { PlasmoMessaging } from "@plasmohq/messaging";

const API_URL = "https://zdbk.zju.edu.cn/jwglxt/kbcx/xskbcx_cxXsKb.html";
const DEFAULT_GNMKDM = "N253508";
const DEFAULT_STUDENT_ID = ""; // Removed for privacy
const DEFAULT_SHOW_COUNT = "15"

type QueryContext = {
  xnm: string
  xqm: string
  xqmmc: string
}

const YEAR_FIELD_ALIASES = [
  "xnm",
  "xn",
  "xnmc",
  "xnxqmc",
  "academic_year",
  "academicYear",
  "school_year",
  "schoolYear",
]

const TERM_FIELD_ALIASES = [
  "xqm",
  "xq",
  "xqmc",
  "xqmmc",
  "xqmcDisplay",
  "term",
  "semester",
  "semester_name",
]

function toArrayIfPossible(value: unknown): any[] {
  return Array.isArray(value) ? value : []
}

function getKbListLength(payload: any): number {
  return toArrayIfPossible(payload?.kbList).length
}

function sanitizeStudentId(studentId: string) {
  return (studentId || "").replace(/\D/g, "")
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim()
}

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]/g, "")
}

function getValuesByAliasKeys(obj: Record<string, any>, aliases: string[]): string[] {
  const aliasSet = new Set(aliases.map(normalizeKey))
  const result: string[] = []
  Object.keys(obj || {}).forEach((key) => {
    if (!aliasSet.has(normalizeKey(key))) return
    const raw = obj[key]
    if (raw == null) return
    const text = normalizeText(raw)
    if (text) result.push(text)
  })
  return result
}

function getExpectedTermCodes(termName: string): string[] {
  const codeMap: Record<string, string[]> = {
    秋: ["1"],
    冬: ["2"],
    春: ["2", "3"],
    夏: ["4"],
  }
  return codeMap[termName] || []
}

function includesAny(source: string, expected: string[]) {
  if (!source) return false
  return expected.some(token => token && source.includes(token))
}

function termMatches(rawTerm: string, expectedNames: string[], expectedCodes: string[]) {
  const term = normalizeText(rawTerm)
  if (!term) return true
  if (includesAny(term, expectedNames)) return true
  if (expectedCodes.some(code => code && term === code)) return true

  const [prefix] = term.split("|")
  if (expectedCodes.some(code => code && prefix === code)) return true
  return false
}

function yearMatches(rawYear: string, expectedYear: string, expectedStartYear: string) {
  const year = normalizeText(rawYear)
  if (!year) return true
  return year.includes(expectedYear) || year.includes(expectedStartYear)
}

function collectContextCandidates(target: Record<string, any>) {
  const yearCandidates = [
    ...getValuesByAliasKeys(target, YEAR_FIELD_ALIASES),
    target?.xnm,
    target?.xn,
    target?.xnmc,
    target?.xnxqmc,
  ].map(normalizeText).filter(Boolean)

  const termCandidates = [
    ...getValuesByAliasKeys(target, TERM_FIELD_ALIASES),
    target?.xqm,
    target?.xq,
    target?.xqmc,
    target?.xqmmc,
    target?.xqmcDisplay,
  ].map(normalizeText).filter(Boolean)

  return { yearCandidates, termCandidates }
}

function getPayloadContextMatchStatus(payload: any, context: QueryContext) {
  const expectedYear = normalizeText(context.xnm)
  const expectedStartYear = expectedYear.split("-")[0] || expectedYear
  const contextTermText = normalizeText(context.xqmmc || context.xqm.split("|")[1] || "")
  const expectedTermNames = [contextTermText].filter(Boolean)
  const expectedTermCodes = Array.from(
    new Set([
      ...getExpectedTermCodes(contextTermText),
      ...context.xqm.split("|").map(s => normalizeText(s))
    ].filter(Boolean))
  )

  const payloadObj = payload && typeof payload === "object" ? payload : {}
  const payloadCandidates = collectContextCandidates(payloadObj)
  const payloadHasMetadata = payloadCandidates.yearCandidates.length > 0 || payloadCandidates.termCandidates.length > 0
  const payloadYearOk = payloadCandidates.yearCandidates.length === 0
    ? true
    : payloadCandidates.yearCandidates.some(y => yearMatches(y, expectedYear, expectedStartYear))
  const payloadTermOk = payloadCandidates.termCandidates.length === 0
    ? true
    : payloadCandidates.termCandidates.some(t => termMatches(t, expectedTermNames, expectedTermCodes))

  return {
    payloadObj,
    payloadCandidates,
    payloadHasMetadata,
    payloadYearOk,
    payloadTermOk,
  }
}

function filterKbListByContext(payload: any, context: QueryContext) {
  const kbList = toArrayIfPossible(payload?.kbList)
  if (kbList.length === 0) return payload

  const expectedYear = normalizeText(context.xnm)
  const expectedStartYear = expectedYear.split("-")[0] || expectedYear
  const contextTermText = normalizeText(context.xqmmc || context.xqm.split("|")[1] || "")
  const expectedTermNames = [contextTermText].filter(Boolean)
  const expectedTermCodes = Array.from(
    new Set([
      ...getExpectedTermCodes(contextTermText),
      ...context.xqm.split("|").map(s => normalizeText(s))
    ].filter(Boolean))
  )

  const {
    payloadObj,
    payloadCandidates,
    payloadHasMetadata,
    payloadYearOk,
    payloadTermOk,
  } = getPayloadContextMatchStatus(payload, context)
  const payloadContextMismatch = payloadHasMetadata && (!payloadYearOk || !payloadTermOk)

  if (payloadContextMismatch) {
    console.warn("XZZDPRO: Top-level term metadata mismatched expected context")
    console.warn("XZZDPRO: Expected context:", context)
    console.warn("XZZDPRO: Received top-level year candidates:", payloadCandidates.yearCandidates)
    console.warn("XZZDPRO: Received top-level term candidates:", payloadCandidates.termCandidates)
    return {
      ...payloadObj,
      kbList: [],
    }
  }

  let metadataHitCount = 0
  const filtered = kbList.filter((course: any) => {
    const courseObj = course && typeof course === "object" ? course : {}
    const { yearCandidates, termCandidates } = collectContextCandidates(courseObj)

    if (yearCandidates.length > 0 || termCandidates.length > 0) {
      metadataHitCount += 1
    }

    const yearOk = yearCandidates.length === 0
      ? true
      : yearCandidates.some(y => yearMatches(y, expectedYear, expectedStartYear))

    const termOk = termCandidates.length === 0
      ? true
      : termCandidates.some(t => termMatches(t, expectedTermNames, expectedTermCodes))

    return yearOk && termOk
  })

  // If server returns course rows but provides no year/term metadata at all,
  // prefer safety: do not accept potentially stale cross-term data.
  if (filtered.length > 0 && metadataHitCount === 0 && !payloadHasMetadata) {
    console.warn("XZZDPRO: Rejecting kbList because term metadata is unverifiable")
    return {
      ...payloadObj,
      kbList: [],
    }
  }

  // Defensive fallback: never drop to empty when server payload lacks term fields.
  if (filtered.length === 0) {
    if (metadataHitCount === 0) {
      console.warn("XZZDPRO: Term filter found no usable term metadata, fallback to raw kbList")
      const firstItem = kbList[0]
      if (firstItem && typeof firstItem === "object") {
        console.warn("XZZDPRO: First kbList item keys:", Object.keys(firstItem))
      }
      if (payloadHasMetadata) {
        console.warn("XZZDPRO: Top-level metadata matched context, allowing raw kbList fallback")
      }
      return payload
    }
    console.warn("XZZDPRO: Term filter removed all entries by strict year/term match")
    return {
      ...payload,
      kbList: [],
    }
  }

  if (filtered.length !== kbList.length) {
    console.log(`XZZDPRO: Term filter reduced kbList from ${kbList.length} to ${filtered.length}`)
  }

  return {
    ...payload,
    kbList: filtered,
  }
}

function normalizeXnmVariants(xnm: string): string[] {
  const set = new Set<string>()
  if (xnm) {
    set.add(xnm)
  }

  // Keep full academic year as the primary signal.
  // Avoid degrading "2025-2026" into "2025", which may map to ambiguous/older data.
  if (/^\d{4}$/.test(xnm)) {
    set.add(`${xnm}-${Number(xnm) + 1}`)
  }

  return Array.from(set)
}

function getXqmVariants(xqm: string, xqmmc: string): QueryContext[] {
  const termText = (xqmmc || xqm.split("|")[1] || "").trim()

  const termCodeMap: Record<string, string> = {
    秋: "1",
    冬: "2",
    春: "2",
    夏: "4",
  }

  const code = termCodeMap[termText] || ""
  const set = new Set<string>()
  const result: QueryContext[] = []

  const push = (candidateXqm: string, candidateName: string) => {
    const key = `${candidateXqm}|${candidateName}`
    if (!candidateXqm || set.has(key)) return
    set.add(key)
    result.push({
      xnm: "",
      xqm: candidateXqm,
      xqmmc: candidateName || termText,
    })
  }

  push(xqm, xqmmc)
  if (termText) {
    push(`1|${termText}`, termText)
    push(termText, termText)
  }
  if (code) {
    push(code, termText)
    push(`${code}|${termText}`, termText)
    push(`1|${termText}`, termText)
  }

  return result
}

function getTermContext() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  let xnm = "";
  let termName = ""

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
  xnm = `${startYear}-${startYear + 1}`;

  // Term Calculation
  if (month >= 9 && month <= 11) {
    termName = month === 11 ? "冬" : "秋"
  } else if (month == 12 || month == 1) {
    termName = "冬"
  } else if (month >= 2 && month <= 4) {
    termName = "春"
  } else if (month >= 5 && month <= 7) {
    termName = "夏"
  } else {
    termName = "秋"
  }

  const termCodeMap: Record<string, string> = {
    秋: "1",
    冬: "2",
    春: "2",
    夏: "4",
  }
  const termCode = termCodeMap[termName] || "1"
  const xqm = `${termCode}|${termName}`
  const xqmmc = termName
  return { xnm, xqm, xqmmc };
}

function buildForm(studentId: string, context?: QueryContext): URLSearchParams {
  const termContext = getTermContext()
  const xnm = context?.xnm || termContext.xnm
  const xqm = context?.xqm || termContext.xqm
  const xqmmc = context?.xqmmc || termContext.xqmmc
  console.log(`XZZDPRO: Querying for xnm=${xnm}, xqm=${xqm}, xqmmc=${xqmmc}`);

  const form = new URLSearchParams();
  form.set("xnm", xnm);
  form.set("xn", xnm);
  form.set("xqm", xqm);
  form.set("xq", xqm);
  form.set("xqmmc", xqmmc);
  form.set("xxqf", "0");
  form.set("xsfs", "0");
  form.set("kzlx", "ck"); // Control Type: Check/View
  form.set("_search", "false");
  form.set("nd", Date.now().toString());
  form.set("queryModel.showCount", DEFAULT_SHOW_COUNT);
  form.set("queryModel.currentPage", "1");
  form.set("queryModel.sortName", "xkkh");
  form.set("queryModel.sortOrder", "asc");
  form.set("time", "0");
  form.set("gnmkdm", DEFAULT_GNMKDM);
  form.set("su", studentId);
  return form;
}

async function requestTimetable(form: URLSearchParams, queryUrl: string) {
  console.log("XZZDPRO: Request timetable URL:", queryUrl);
  console.log("XZZDPRO: Request timetable body:", form.toString());
  const response = await fetch(
    queryUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: form.toString(),
      credentials: "include",
    }
  )

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
    return json
  } catch (e) {
    console.error("XZZDPRO: Failed to parse JSON", e);
    return null;
  }
}

async function initTimetablePageContext(su: string) {
  const indexUrl = `https://zdbk.zju.edu.cn/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=${encodeURIComponent(DEFAULT_GNMKDM)}&layout=default&su=${encodeURIComponent(su)}`
  console.log("XZZDPRO: Initializing timetable index context:", indexUrl)
  const indexRes = await fetch(indexUrl, {
    method: "GET",
    credentials: "include",
  })
  console.log("XZZDPRO: Timetable index status:", indexRes.status, indexRes.statusText)
  return indexUrl
}

async function applyTermContext(su: string, context: QueryContext) {
  const encodedXqm = encodeURIComponent(context.xqm).replace(/%7C/g, "|");
  const setContextUrl = `https://zdbk.zju.edu.cn/jwglxt/kbcx/xskbcx_cxSfkc.html?xn=${context.xnm}&xqm=${encodedXqm}&gnmkdm=${DEFAULT_GNMKDM}&su=${su}`;
  console.log("XZZDPRO: Request set-context URL:", setContextUrl);
  const setContextRes = await fetch(setContextUrl, {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "include",
  });
  console.log("XZZDPRO: Set-context status:", setContextRes.status, setContextRes.statusText)
}

async function fetchTimetable(studentId: string) {
  console.log("XZZDPRO: Starting fetchTimetable...");
  const su = sanitizeStudentId(studentId) || DEFAULT_STUDENT_ID;
  const strictContext = getTermContext()

  try {
    // Step 1: Initialize index page context, then set term context.
    await initTimetablePageContext(su)
    console.log(`XZZDPRO: Setting context to Year ${strictContext.xnm}, Term ${strictContext.xqm}`);
    await applyTermContext(su, strictContext)

    // Step 2: Get Data (cxXsKb)
    const queryUrl = `${API_URL}?gnmkdm=${encodeURIComponent(DEFAULT_GNMKDM)}&layout=default&su=${encodeURIComponent(su)}`
    const primaryForm = buildForm(su)
    const primaryRawData = await requestTimetable(primaryForm, queryUrl)
    const primaryData = filterKbListByContext(primaryRawData, strictContext)

    // If empty timetable, retry with alternate xnm/xqm formats.
    if (primaryData && getKbListLength(primaryData) === 0) {
      const defaultTerm = getTermContext()
      const xnmVariants = normalizeXnmVariants(String(primaryData?.xnm || defaultTerm.xnm))
      const xqmVariants = getXqmVariants(
        String(primaryData?.xqm || defaultTerm.xqm),
        String(primaryData?.xqmmc || defaultTerm.xqmmc)
      )
      console.log("XZZDPRO: Retry variants:", { xnmVariants, xqmVariants })

      for (const xnm of xnmVariants) {
        for (const xqmCtx of xqmVariants) {
          const retryCtx: QueryContext = {
            xnm,
            xqm: xqmCtx.xqm,
            xqmmc: xqmCtx.xqmmc,
          }
          await applyTermContext(su, retryCtx)
          const retryForm = buildForm(su, retryCtx)
          console.log("XZZDPRO: Retry timetable with context:", retryCtx)
          const retryRawData = await requestTimetable(retryForm, queryUrl)
          const retryData = filterKbListByContext(retryRawData, strictContext)
          console.log("XZZDPRO: Retry result summary:", {
            retryCtx,
            rawKbListLength: getKbListLength(retryRawData),
            filteredKbListLength: getKbListLength(retryData),
            rawXnm: retryRawData?.xnm,
            rawXqm: retryRawData?.xqm,
          })
          if (retryData && getKbListLength(retryData) > 0) {
            return retryData
          }
        }
      }
    }

    return primaryData
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
      console.log("XZZDPRO: Sending timetable summary:", {
        xnm: data?.xnm,
        xqm: data?.xqm,
        kbListLength: getKbListLength(data),
      })
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
