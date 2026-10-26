// UTF BOMs take precedence. Otherwise prefer strict UTF-8 and fall back to
// GB18030, which covers the common GBK/GB2312 Chinese text files.
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes)
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes) }
  catch { return new TextDecoder("gb18030", { fatal: true }).decode(bytes) }
}
