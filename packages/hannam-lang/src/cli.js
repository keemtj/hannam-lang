// hannam, hnc가 함께 쓰는 CLI 도우미
import { readFileSync } from "node:fs"
import { isHannamSyntaxError } from "./transform.js"

/** @returns {string} */
export function version() {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  return pkg.version
}

/**
 * 컴파일 에러는 위치와 코드 조각이 담긴 message만 stderr에 쓴다. 그 외 에러는 false를 돌려준다.
 * @param {unknown} error
 */
export function reportSyntaxError(error) {
  if (!isHannamSyntaxError(error)) return false
  process.stderr.write(`${error.message}\n`)
  return true
}
