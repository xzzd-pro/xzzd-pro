/**
 * Computes the SHA-256 hash of binary data.
 * @param buffer Data to hash.
 * @returns Lowercase hex digest.
 */
export async function hashArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return bufferToHex(new Uint8Array(digest))
}

/**
 * Computes the SHA-256 hash of a string's UTF-8 bytes.
 * @param text Text to hash.
 * @returns Lowercase hex digest.
 */
export async function hashString(text: string): Promise<string> {
  const encoder = new TextEncoder()
  return hashArrayBuffer(encoder.encode(text).buffer)
}

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
