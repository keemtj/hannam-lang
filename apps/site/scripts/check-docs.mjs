// 문서와 README의 ```hn 블록, <TryIt code={...}> 코드가 실제로 컴파일되는지 확인한다.
// ```hn 바로 다음에 ```js 블록이 오면 변환 결과와 같은지도 비교한다.
// 사용법: node scripts/check-docs.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { compile } from "@hannam-lang/core"

const root = fileURLToPath(new URL("../content/docs", import.meta.url))
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url))
// 저장소의 README도 같은 기준으로 검사한다. 사이트 문서와 README의 예시가 실제 동작과 어긋나지 않게 하려는 것이다
const readmes = [
  "README.md",
  "README.en.md",
  "CONTRIBUTING.md",
  "examples/todo/README.md",
  ...readdirSync(join(repoRoot, "packages")).map((dir) => `packages/${dir}/README.md`),
]
  .map((path) => join(repoRoot, path))
  .filter((path) => existsSync(path))
// 컴파일 에러를 보여 주려고 일부러 틀리게 쓴 블록
const expectedErrors = ["예???? 개수 > 0 {"]

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".mdx") ? [path] : []
  })
}

// 런타임 import 줄과 줄 끝 공백은 비교에서 뺀다 (명세 예시가 import 줄을 생략함)
const normalize = (code) =>
  code
    .split("\n")
    .filter((line) => !line.startsWith('import { __hn } from "hannam-lang/runtime"'))
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()

// 짝: js 블록에 제목이 없거나, 제목이 hn 블록 파일 이름의 .js판으로 시작할 때 (hello.hn ↔ hello.js)
const titleOf = (meta) => meta.match(/title="([^"]*)"/)?.[1]
function isPair(hnMeta, jsMeta) {
  const jsTitle = titleOf(jsMeta)
  if (!jsTitle) return true
  const hnTitle = titleOf(hnMeta)
  return Boolean(hnTitle) && jsTitle.startsWith(hnTitle.replace(/\.hn$/, ".js"))
}

let failures = 0
let checked = 0
let compared = 0

for (const file of [...walk(root), ...readmes]) {
  const text = readFileSync(file, "utf8")
  const name = file.startsWith(root) ? relative(root, file) : relative(repoRoot, file)
  const blocks = [...text.matchAll(/^( *)```(\w+)([^\n]*)\n([\s\S]*?)^\1```$/gm)].map((m) => ({
    lang: m[2],
    meta: m[3],
    code: m[4].replace(new RegExp(`^${m[1]}`, "gm"), ""),
  }))
  const tryIts = [...text.matchAll(/<TryIt code=\{("(?:[^"\\]|\\.)*")\}/g)].map((m) => ({
    lang: "hn",
    meta: "TryIt",
    code: JSON.parse(m[1]),
  }))

  blocks.forEach((block, i) => {
    if (block.lang !== "hn") return
    checked++
    const shouldFail = expectedErrors.some((s) => block.code.includes(s))
    let out
    try {
      out = compile(block.code, { filename: "doc.hn", rewriteImports: block.meta.includes("hnc") }).code
    } catch (e) {
      if (!shouldFail) {
        failures++
        console.error(`✗ ${name} hn 블록 #${i}: ${e.message}`)
      }
      return
    }
    if (shouldFail) {
      failures++
      console.error(`✗ ${name} hn 블록 #${i}: 에러가 나야 하는데 컴파일됨`)
      return
    }
    const next = blocks[i + 1]
    if (next?.lang === "js" && isPair(block.meta, next.meta)) {
      compared++
      // hnc 출력 예시는 rewriteImports를 켜고 다시 비교한다
      const expected = next.meta.includes("hnc")
        ? compile(block.code, { filename: "doc.hn", rewriteImports: true }).code
        : out
      if (normalize(expected) !== normalize(next.code)) {
        failures++
        console.error(`✗ ${name} hn 블록 #${i}: 짝 js 블록과 변환 결과가 다름\n--- 변환 결과\n${expected}\n--- 문서\n${next.code}`)
      }
    }
  })

  for (const t of tryIts) {
    checked++
    try {
      compile(t.code, { filename: "tryit.hn" })
    } catch (e) {
      failures++
      console.error(`✗ ${name} TryIt: ${e.message}`)
    }
  }
}

console.log(`hn 코드 ${checked}개 컴파일, js 짝 ${compared}개 비교, 실패 ${failures}개`)
process.exit(failures ? 1 : 0)
