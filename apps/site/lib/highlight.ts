// 메인 페이지 코드 조각을 서버에서 칠한다 (문서와 같은 hn 문법, 같은 테마)
import { createHighlighter, type Highlighter } from "shiki"
import { createOnigurumaEngine } from "shiki/engine/oniguruma"
import { hnLanguage } from "./mz-grammar"

let highlighter: Promise<Highlighter> | undefined

function getHighlighter() {
  highlighter ??= createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: ["javascript", hnLanguage],
    engine: createOnigurumaEngine(import("shiki/wasm")),
  }).catch((error: unknown) => {
    // 실패한 Promise를 붙잡아 두지 않고 다음 호출에서 다시 만든다
    highlighter = undefined
    throw error
  })
  return highlighter
}

export async function highlight(code: string, lang: "mz" | "javascript"): Promise<string> {
  const h = await getHighlighter()
  return h.codeToHtml(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  })
}
