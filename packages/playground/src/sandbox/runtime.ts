// iframe 안에서 `mzscript/runtime`으로 공급하는 브라우저용 런타임.
// @mzscript/core/runtime의 __mz와 같은 동작을 하되, 브라우저에 필요한 부분만 담는다.
// (core 런타임 파일은 번들러마다 원문을 가져오는 방법이 달라서 소스를 여기 둔다.
//  동작이 같은지는 test/runtime.test.ts에서 core 런타임과 비교한다.)
export const RUNTIME_SOURCE = `export const __mz = {
  toError(value) {
    return typeof value === "string" ? new Error(value) : value
  },
  confirm(question) {
    return globalThis.confirm(String(question))
  },
}
`

export const RUNTIME_SPECIFIER = "mzscript/runtime"

export function runtimeDataUrl(): string {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(RUNTIME_SOURCE)}`
}
