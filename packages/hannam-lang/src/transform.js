import { pathToFileURL } from "node:url"
import { compile } from "@hannam-lang/core"

/**
 * 메모리에서 실행할 .hn 소스를 JS 모듈 코드로 바꾼다.
 * 소스맵을 인라인으로 붙여 에러 스택이 .hn 원본 줄을 가리키게 한다.
 * @param {string} source
 * @param {string} filename 소스맵 sources에 들어갈 .hn 파일의 절대 경로
 * @param {string} runtimeImport 이 패키지의 런타임 모듈 지정자
 */
export function transform(source, filename, runtimeImport) {
  const { code, map } = compile(source, { filename, runtimeImport })
  // Windows 경로(C:\\...)가 URL scheme으로 잘못 읽히지 않도록 소스맵에는 file URL을 넣는다
  map.sources = [pathToFileURL(filename).href]
  return `${code}${code.endsWith("\n") ? "" : "\n"}//# sourceMappingURL=${map.toUrl()}\n`
}

/**
 * HannamSyntaxError인지 확인한다. 로더 훅 스레드를 건너오면 클래스 정보가 사라지므로 name으로 본다.
 * @param {unknown} error
 * @returns {error is Error}
 */
export function isHannamSyntaxError(error) {
  return error instanceof Error && error.name === "HannamSyntaxError"
}
