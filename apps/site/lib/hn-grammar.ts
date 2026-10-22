// VS Code 확장의 TextMate 문법을 Shiki 언어 `hn`으로 등록한다.
// 문법은 source.js를 include하므로 Shiki 내장 javascript를 함께 불러온다.
// source.config.ts(Node가 직접 불러옴)와 Next 번들 양쪽에서 쓰므로 JSON import 속성을 붙인다.
import type { LanguageRegistration } from "shiki"
import grammar from "hannam-lang-vscode/syntaxes/hannam.tmLanguage.json" with { type: "json" }

export const hnLanguage: LanguageRegistration = {
  ...(grammar as unknown as LanguageRegistration),
  name: "hn",
  aliases: ["hannam"],
  embeddedLangs: ["javascript"],
}
