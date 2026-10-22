// 디버깅용: .hn 파일의 토큰과 scope를 출력한다
// 사용법: node --experimental-strip-types scripts/dump-tokens.ts <파일...>
import { readFileSync } from "node:fs"
import { tokenize } from "../test/tokenize.ts"

for (const file of process.argv.slice(2)) {
  console.log(`=== ${file}`)
  for (const token of await tokenize(readFileSync(file, "utf8"))) {
    if (token.text.trim()) console.log(token.line, JSON.stringify(token.text), token.scopes.slice(1).join(" "))
  }
}
