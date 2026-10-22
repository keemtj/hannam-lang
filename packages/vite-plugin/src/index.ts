import { fileURLToPath } from "node:url"
import { compile, HannamSyntaxError } from "@hannam-lang/core"
import type { Plugin } from "vite"

export interface HannamPluginOptions {
  /**
   * 변환 결과가 런타임 헬퍼를 가져올 모듈 이름 (기본값 `"hannam-lang/runtime"`).
   * 이 이름은 플러그인이 `@hannam-lang/core/runtime`의 실제 파일로 풀어 준다.
   */
  runtimeImport?: string
}

const HN_RE = /\.hn$/

/** `/src/main.hn?import&t=123` 같은 요청 id에서 쿼리와 해시를 뗀다 */
function cleanId(id: string): string {
  return id.replace(/[?#].*$/, "")
}

export default function hannam(options: HannamPluginOptions = {}): Plugin {
  const runtimeImport = options.runtimeImport ?? "hannam-lang/runtime"
  // 사용자 앱이 런타임 패키지를 직접 설치하지 않아도 되도록 플러그인 자신의 의존성에서 찾는다
  const runtimePath = fileURLToPath(import.meta.resolve("@hannam-lang/core/runtime"))

  return {
    name: "hannam-lang",
    enforce: "pre",

    resolveId(source) {
      if (source === runtimeImport) return runtimePath
      return null
    },

    transform(code, id) {
      const file = cleanId(id)
      if (!HN_RE.test(file)) return null
      try {
        const { code: js, map, warnings } = compile(code, { filename: file, runtimeImport })
        for (const w of warnings) this.warn({ message: w.message, id: file, loc: { file, line: w.line, column: w.column } })
        // Vite 8(rolldown)은 확장자로 모듈 종류를 짐작하므로 JS라고 알려 준다. Vite 7은 이 값을 무시한다
        return { code: js, map: map.toString(), moduleType: "js" }
      } catch (err) {
        if (err instanceof HannamSyntaxError) {
          // 에러 오버레이와 빌드 로그에 .hn 파일·줄·칸과 코드 조각이 나오도록 Rollup 에러 형식으로 넘긴다
          // 코드 조각은 frame으로 따로 넘기므로 message에서는 뗀다
          const message = err.message.endsWith(`\n${err.frame}`)
            ? err.message.slice(0, -(err.frame.length + 1))
            : err.message
          this.error({
            message,
            id: file,
            loc: { file, line: err.line, column: err.column },
            frame: err.frame,
          })
        }
        throw err
      }
    },
  }
}
