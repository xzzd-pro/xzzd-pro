/** Share of the bulletin page given to the unread column (the read column gets the rest). */
export const SPLIT_STORAGE_KEY = "bulletinSplitRatio"
export const SPLIT_DEFAULT = 0.5
export const SPLIT_MIN = 0.25
export const SPLIT_MAX = 0.75
export const SPLIT_KEYBOARD_STEP = 0.05
/** Width of the drag strip between the two cards, in px. */
export const SPLIT_HANDLE_WIDTH = 24

/**
 * Turns a stored value into a valid column ratio.
 * @param value Stored ratio as a number or numeric string.
 * @returns The ratio clamped to [SPLIT_MIN, SPLIT_MAX], or SPLIT_DEFAULT if the value is missing or not a number.
 */
export function clampSplitRatio(value: unknown): number {
  // Number(null) and Number("") are 0, which would collapse the column; treat them as missing.
  const ratio =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN
  if (!Number.isFinite(ratio)) return SPLIT_DEFAULT
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ratio))
}

/**
 * Ratio for a pointer at `clientX` over a container whose columns are
 * [left card][handle][right card]; the pointer sits at the handle's center.
 */
export function ratioFromPointer(
  clientX: number,
  container: { left: number; width: number },
  handleWidth = SPLIT_HANDLE_WIDTH
): number {
  const available = container.width - handleWidth
  if (available <= 0) return SPLIT_DEFAULT
  return clampSplitRatio(
    (clientX - container.left - handleWidth / 2) / available
  )
}

/** `grid-template-columns` value; minmax(0, …) keeps long titles from widening a column. */
export function splitColumns(
  ratio: number,
  handleWidth = SPLIT_HANDLE_WIDTH
): string {
  const left = clampSplitRatio(ratio)
  return `minmax(0, ${left}fr) ${handleWidth}px minmax(0, ${1 - left}fr)`
}
