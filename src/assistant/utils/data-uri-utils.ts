const IMAGE_DATA_URI_REGEX =
  /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/]+={0,2})$/i

/**
 * Checks that a value is a PNG or JPEG data URI with valid base64.
 * @param value Value to check.
 * @returns True if it can be sent as an image.
 */
export function isValidImageDataUri(value: string): boolean {
  if (!value || typeof value !== "string") return false
  const match = value.match(IMAGE_DATA_URI_REGEX)
  if (!match) return false
  try {
    // Validate base64 payload
    atob(match[2])
    return true
  } catch {
    return false
  }
}

/**
 * @param value A base64 data URI.
 * @returns The base64 part, or null if the value is not a base64 data URI.
 */
export function extractBase64FromDataUri(value: string): string | null {
  const match = value.match(/^data:([^;]+);base64,([A-Za-z0-9+/]+={0,2})$/i)
  if (!match) return null
  return match[2]
}

/**
 * @param value A base64 data URI.
 * @returns Its MIME type, or null if it has none.
 */
export function getDataUriMimeType(value: string): string | null {
  const match = value.match(/^data:([^;]+);base64,/i)
  return match ? match[1] : null
}

/**
 * Computes the decoded size of a base64 data URI without decoding it.
 * @param value A base64 data URI.
 * @returns Size in bytes; 0 if the value is not a data URI.
 */
export function estimateDataUriBytes(value: string): number {
  const base64 = extractBase64FromDataUri(value)
  if (!base64) return 0
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.floor(base64.length * 0.75) - padding
}

/**
 * Decodes a base64 data URI into a Blob.
 * @param value A base64 data URI.
 * @returns Blob with the URI's MIME type.
 * @throws If the value is not a base64 data URI.
 */
export function dataUriToBlob(value: string): Blob {
  const base64 = extractBase64FromDataUri(value)
  const mimeType = getDataUriMimeType(value) || "application/octet-stream"
  if (!base64) {
    throw new Error("Invalid data URI")
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}
