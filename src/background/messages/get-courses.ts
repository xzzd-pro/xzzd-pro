import { TimetableRequestError, checkTimetableResponse, performBackgroundLogin } from "../timetableAccess"
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
  return String(studentId ?? "").replace(/\D/g, "")
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
    秋冬: ["1", "2"],
    春夏: ["2", "3", "4"],
  }
  return codeMap[termName] || []
}

function getExpectedTermNames(termName: string): string[] {
  const nameMap: Record<string, string[]> = {
    秋冬: ["秋冬", "秋", "冬"],
    春夏: ["春夏", "春", "夏"],
  }
  return nameMap[termName] || [termName]
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
  const expectedTermNames = getExpectedTermNames(contextTermText).filter(Boolean)
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
  const expectedTermNames = getExpectedTermNames(contextTermText).filter(Boolean)
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

  // Only allow row metadata fallback when the payload itself confirms the context.
  if (filtered.length === 0) {
    if (metadataHitCount === 0) {
      console.warn("XZZDPRO: Term filter found no usable row-level term metadata")
      const firstItem = kbList[0]
      if (firstItem && typeof firstItem === "object") {
        console.warn("XZZDPRO: First kbList item keys:", Object.keys(firstItem))
      }
      if (payloadHasMetadata) {
        console.warn("XZZDPRO: Top-level metadata matched context, allowing raw kbList fallback")
        return payload
      }
      console.warn("XZZDPRO: Rejecting kbList because neither payload nor rows expose term metadata")
      return {
        ...payloadObj,
        kbList: [],
      }
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
    秋冬: "1",
    春夏: "3",
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

  // Fallback only. Prefer the selected context from ZDBK timetable page.

  // Academic Year Calculation
  // If we are in Aug-Dec, academic year starts this year.
  // If we are in Jan-Jul, academic year started last year.

  let startYear = year;
  if (month < 8) {
    startYear = year - 1;
  }
  xnm = `${startYear}-${startYear + 1}`;

  // Match the ZDBK selector labels used by the timetable page.
  if (month >= 9 && month <= 11) {
    termName = month === 11 ? "冬" : "秋"
  } else if (month === 12 || month === 1) {
    termName = "冬"
  } else if (month >= 2 && month <= 5) {
    termName = "春"
  } else if (month >= 6 && month <= 7) {
    termName = "夏"
  } else {
    termName = "秋"
  }

  const termCodeMap: Record<string, string> = {
    秋: "1",
    冬: "2",
    春: "2",
    夏: "4",
    秋冬: "1",
    春夏: "3",
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

function decodeHtmlText(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
}

function stripTags(value: string): string {
  return decodeHtmlText(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
}

function getAttributeValue(tag: string, attribute: string): string {
  const match = tag.match(
    new RegExp(`\\s${attribute}\\s*=\\s*["']([^"']*)["']`, "i")
  )
  return match ? decodeHtmlText(match[1]).trim() : ""
}

function getSelectedOptionFromSelect(html: string, fieldName: string) {
  const selectRegex = /<select\b[^>]*>[\s\S]*?<\/select>/gi
  let selectMatch: RegExpExecArray | null

  while ((selectMatch = selectRegex.exec(html))) {
    const selectHtml = selectMatch[0]
    const openTag = selectHtml.match(/<select\b[^>]*>/i)?.[0] || ""
    const id = getAttributeValue(openTag, "id")
    const name = getAttributeValue(openTag, "name")
    if (id !== fieldName && name !== fieldName) continue

    const optionMatches = Array.from(
      selectHtml.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)
    )
    const selected =
      optionMatches.find((option) => /\sselected(?:\s|=|>)/i.test(option[1])) ||
      optionMatches[0]

    if (!selected) return null

    return {
      value: getAttributeValue(selected[0], "value"),
      label: stripTags(selected[2]),
    }
  }

  return null
}

function parseContextFromTimetableIndex(html: string): QueryContext | null {
  const yearOption = getSelectedOptionFromSelect(html, "xnm")
  const termOption = getSelectedOptionFromSelect(html, "xqm")

  const xnm = yearOption?.value || yearOption?.label || ""
  const xqmValue = termOption?.value || ""
  const xqmmc = termOption?.label || xqmValue.split("|")[1] || ""
  const xqm = xqmValue.includes("|") || !xqmmc ? xqmValue : `${xqmValue}|${xqmmc}`

  if (!xnm || !xqm) {
    console.warn("XZZDPRO: Could not parse selected term context from timetable page")
    return null
  }

  return { xnm, xqm, xqmmc }
}

async function requestTimetable(form: URLSearchParams, queryUrl: string) {
  const response = await fetch(queryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: form.toString(),
    credentials: "include",
  })
  checkTimetableResponse(response)
  const text = await response.text()
  let data: any
  try { data = JSON.parse(text) } catch {
    if (/<form[\s\S]*type\s*=\s*["']password["']/i.test(text)) {
      throw new TimetableRequestError("需要登录教务系统", "login_required")
    }
    throw new TimetableRequestError("教务系统返回了非课表数据，请稍后重试。", "invalid_response")
  }
  if (!data || !Array.isArray(data.kbList)) {
    throw new TimetableRequestError("教务系统返回的课表格式不正确，请稍后重试。", "invalid_response")
  }
  return data
}

async function initTimetablePageContext(su: string): Promise<QueryContext | null> {
  const indexUrl = `https://zdbk.zju.edu.cn/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=${encodeURIComponent(DEFAULT_GNMKDM)}&layout=default&su=${encodeURIComponent(su)}`
  console.log("XZZDPRO: Initializing timetable index context:", indexUrl)
  const indexRes = await fetch(indexUrl, {
    method: "GET",
    credentials: "include",
  })
  console.log("XZZDPRO: Timetable index status:", indexRes.status, indexRes.statusText)
  checkTimetableResponse(indexRes)
  const contentType = indexRes.headers.get("content-type") || ""
  if (!indexRes.ok || !contentType.includes("text/html")) {
    console.warn("XZZDPRO: Skip parsing timetable index context", {
      status: indexRes.status,
      contentType,
    })
    return null
  }
  const indexHtml = await indexRes.text()
  const context = parseContextFromTimetableIndex(indexHtml)
  console.log("XZZDPRO: Timetable index selected context:", context)
  return context
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
  checkTimetableResponse(setContextRes)
}

async function fetchTimetable(studentId: string) {
  console.log("XZZDPRO: Starting fetchTimetable...");
  const su = sanitizeStudentId(studentId) || DEFAULT_STUDENT_ID;

  try {
    // Step 1: Initialize index page context, then set term context.
    const indexContext = await initTimetablePageContext(su)
    const strictContext = indexContext || getTermContext()
    console.log("XZZDPRO: Final timetable query context:", strictContext)
    console.log(`XZZDPRO: Setting context to Year ${strictContext.xnm}, Term ${strictContext.xqm}`);
    await applyTermContext(su, strictContext)

    // Step 2: Get Data (cxXsKb)
    const queryUrl = `${API_URL}?gnmkdm=${encodeURIComponent(DEFAULT_GNMKDM)}&layout=default&su=${encodeURIComponent(su)}`
    const primaryForm = buildForm(su, strictContext)
    const primaryRawData = await requestTimetable(primaryForm, queryUrl)
    const primaryData = filterKbListByContext(primaryRawData, strictContext)

    // If empty timetable, retry with alternate xnm/xqm formats.
    if (primaryData && getKbListLength(primaryData) === 0) {
      const xnmVariants = normalizeXnmVariants(String(primaryData?.xnm || strictContext.xnm))
      const xqmVariants = getXqmVariants(
        String(primaryData?.xqm || strictContext.xqm),
        String(primaryData?.xqmmc || strictContext.xqmmc)
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
    throw error;
  }
}

async function getTimetableResponse(studentId: string) {
  try {
    return { status: "ok", data: await fetchTimetable(studentId) }
  } catch (error) {
    if (error instanceof TimetableRequestError &&
        (error.code === "login_required" || error.status === 901 || error.status === 403)) {
      const login = await performBackgroundLogin()
      if (login === "login_required") return { status: "login_required" }
      if (login === "ok") {
        try { return { status: "ok", data: await fetchTimetable(studentId) } }
        catch (retryError) { error = retryError }
      }
    }
    if (error instanceof TimetableRequestError && error.code === "login_required") {
      return { status: "login_required" }
    }
    return {
      status: "error",
      message: error instanceof TimetableRequestError ? error.message : "无法连接教务系统，请检查网络后重试。",
    }
  }
}

const pendingRequests = new Map<string, Promise<Awaited<ReturnType<typeof getTimetableResponse>>>>()
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const studentId = sanitizeStudentId(req.body?.studentId)
  let pending = pendingRequests.get(studentId)
  if (!pending) {
    pending = getTimetableResponse(studentId).finally(() => pendingRequests.delete(studentId))
    pendingRequests.set(studentId, pending)
  }
  res.send(await pending)
}

export default handler
