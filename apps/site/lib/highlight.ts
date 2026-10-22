// 메인 페이지 코드 조각을 서버에서 칠한다 (문서와 같은 hn 문법, 같은 테마)
import { createHighlighter, type Highlighter } from "shiki"
import { createOnigurumaEngine } from "shiki/engine/oniguruma"
import { hnLanguage } from "./hn-grammar"

let highlighter: Promise<Highlighter> | undefined

function getHighlighter() {
  highlighter ??= createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: ["javascript", hnLanguage],
    engine: createOnigurumaEngine(import("shiki/wasm")),
  })
  return highlighter
}

export async function highlight(code: string, lang: "hn" | "javascript" | "sh"): Promise<string> {
  const h = await getHighlighter()
  return h.codeToHtml(code, {
    lang: lang === "sh" ? "text" : lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  })
}
