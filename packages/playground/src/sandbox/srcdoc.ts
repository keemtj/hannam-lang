import { iframeBootstrap, type BootstrapConfig } from "./bootstrap"
import { instrumentLoops } from "./instrument"
import { MESSAGE_SOURCE } from "./protocol"
import { RUNTIME_SPECIFIER, runtimeDataUrl } from "./runtime"

export interface SrcdocOptions {
  runId: string
  loopLimitMs: number
}

/** `<script>` 안에 넣을 JSON. `</script>`나 `<!--`로 태그가 끊기지 않게 `<`를 이스케이프한다 */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
}

/**
 * 변환된 JS를 실행할 iframe 문서를 만든다.
 * - import map으로 `mzscript/runtime`을 data: URL 런타임에 연결한다
 * - 사용자 코드는 iframe 안에서 blob URL 모듈로 만들어 import한다 (스택에서 줄 번호를 찾기 쉽다)
 */
export function buildSrcdoc(code: string, options: SrcdocOptions): string {
  const config: BootstrapConfig = { source: MESSAGE_SOURCE, runId: options.runId, loopLimitMs: options.loopLimitMs }
  const importMap = { imports: { [RUNTIME_SPECIFIER]: runtimeDataUrl() } }
  const userCode = instrumentLoops(code)
  return `<!doctype html>
<html><head><meta charset="utf-8">
<script type="importmap">${scriptJson(importMap)}</script>
<script>(${iframeBootstrap.toString()})(window, ${scriptJson(config)})</script>
</head><body>
<script type="module">
const url = URL.createObjectURL(new Blob([${scriptJson(userCode)}], { type: "text/javascript" }))
import(url).then(() => window.__mz_done(), (e) => { window.__mz_report(e); window.__mz_done() })
</script>
</body></html>`
}
