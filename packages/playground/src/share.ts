import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string"

const PREFIX = "#code/"
const EMPTY_PAYLOAD = compressToEncodedURIComponent("")

/** 코드를 압축해 URL 해시(`#code/...`)로 만든다 */
export function encodeHash(code: string): string {
  return PREFIX + compressToEncodedURIComponent(code)
}

/** URL 해시에서 코드를 꺼낸다. 형식이 다르거나 깨졌으면 null */
export function decodeHash(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null
  const payload = hash.slice(PREFIX.length)
  const decoded = decompressFromEncodedURIComponent(payload)
  if (decoded === null) return null
  // 깨진 입력도 빈 문자열로 풀리는 경우가 있어서, 진짜 빈 코드만 통과시킨다
  if (decoded === "" && payload !== EMPTY_PAYLOAD) return null
  return decoded
}
