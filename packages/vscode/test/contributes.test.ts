import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"
import { tokenize } from "./tokenize.ts"

const packageRoot = fileURLToPath(new URL("..", import.meta.url))
const readJson = (path: string) => JSON.parse(readFileSync(`${packageRoot}${path}`, "utf8"))

const manifest = readJson("package.json")
const languageConfig = readJson("language-configuration.json")
const snippets: Record<string, { prefix: string[]; body: string[] }> = readJson("snippets/hannam.code-snippets")

describe("package.json contributes", () => {
  test(".hn 파일을 hannam 언어로 등록하고 source.hn 문법을 연결한다", () => {
    const [language] = manifest.contributes.languages
    expect(language).toMatchObject({ id: "hannam", extensions: [".hn"] })
    const [grammar] = manifest.contributes.grammars
    expect(grammar).toMatchObject({ language: "hannam", scopeName: "source.hn" })
    expect(readJson(grammar.path.replace(/^\.\//, "")).scopeName).toBe("source.hn")
  })

  test("contributes가 가리키는 파일이 모두 있다", () => {
    const paths = [
      manifest.contributes.languages[0].configuration,
      manifest.contributes.grammars[0].path,
      manifest.contributes.snippets[0].path,
    ]
    for (const path of paths) expect(existsSync(`${packageRoot}${path}`), path).toBe(true)
  })

  test("배포하지 않는 private 패키지다", () => {
    expect(manifest.private).toBe(true)
  })
})

describe("language-configuration", () => {
  const increase = new RegExp(languageConfig.indentationRules.increaseIndentPattern)
  const decrease = new RegExp(languageConfig.indentationRules.decreaseIndentPattern)

  test("주석은 // 와 /* */", () => {
    expect(languageConfig.comments).toEqual({ lineComment: "//", blockComment: ["/*", "*/"] })
  })

  test("괄호로 끝나는 줄 다음은 들여쓴다", () => {
    for (const line of ["예? 개수 === 0 {", "} 예?? 개수 < 5 {", "} 아뇨아뇨아뇨아뇨 {", "요이~ 할일 할일들 {", "엄.. 목록 = [", "할일추가("]) {
      expect(increase.test(line), line).toBe(true)
    }
  })

  test("주석 안의 괄호나 닫힌 괄호는 들여쓰지 않는다", () => {
    for (const line of ["엄... 블록 {", "// 블록 {", "예? a { 아! 줴줴이야~ }", "엄.. a = f()"]) {
      expect(increase.test(line), line).toBe(false)
    }
  })

  test("닫는 괄호로 시작하는 줄은 내어쓴다", () => {
    for (const line of ["}", "} 지~랄 e {", "  ])"]) expect(decrease.test(line), line).toBe(true)
    expect(decrease.test("무슨 발언이세요? 값")).toBe(false)
  })

  test("자동 닫기 짝", () => {
    const opens = languageConfig.autoClosingPairs.map((pair: { open: string }) => pair.open)
    expect(opens).toEqual(expect.arrayContaining(["{", "[", "(", '"', "'", "`"]))
  })
})

describe("스니펫", () => {
  // 탭 정지를 기본값(없으면 빈 칸)으로 채워 실제 코드처럼 만든다
  const expand = (body: string[]) =>
    body
      .join("\n")
      .replace(/\$\{\d+:([^}]*)\}/g, "$1")
      .replace(/\$\{\d+\}|\$\d+/g, "")

  test.each(Object.entries(snippets))("%s", async (name, snippet) => {
    expect(snippet.prefix.length).toBeGreaterThan(0)
    const tokens = await tokenize(expand(snippet.body))
    // 스니펫 이름의 첫 키워드가 문법에서 키워드로 칠해진다
    const firstMeme = name.split(" ")[0]!
    const isMeme = (scopes: string[]) => scopes.some((scope) => scope.endsWith(".hn") && scope !== "source.hn")
    expect(tokens.some((token) => token.text.startsWith(firstMeme) && isMeme(token.scopes)), name).toBe(true)
  })
})
