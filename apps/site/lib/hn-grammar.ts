// VS Code 확장의 TextMate 문법을 Shiki 언어 `hn`으로 등록한다.
// 문법은 source.js를 include하므로 Shiki 내장 javascript를 함께 불러온다.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import type { LanguageRegistration } from "shiki"

const require = createRequire(import.meta.url)
const grammarPath = require.resolve("hannam-lang-vscode/syntaxes/hannam.tmLanguage.json")
const grammar = JSON.parse(readFileSync(grammarPath, "utf8")) as LanguageRegistration

export const hnLanguage: LanguageRegistration = {
  ...grammar,
  name: "hn",
  aliases: ["hannam"],
  embeddedLangs: ["javascript"],
}
