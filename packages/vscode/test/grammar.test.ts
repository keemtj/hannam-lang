import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"
import { tokenize, type Token } from "./tokenize.ts"

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url))

// 키워드 scope → 그 scope를 받아야 하는 정확한 글자
const memeTexts: Record<string, string> = {
  "storage.type.var.hn": "엄",
  "storage.type.let.hn": "엄.",
  "storage.type.const.hn": "엄..",
  "punctuation.definition.comment.hn": "엄...",
  "keyword.control.conditional.if.hn": "예?",
  "keyword.control.conditional.else-if.hn": "예??",
  "keyword.control.conditional.switch.hn": "예???",
  "keyword.control.conditional.else.hn": "아뇨아뇨아뇨아뇨",
  "keyword.control.loop.for-of.hn": "요이~",
  "keyword.control.loop.for-in.hn": "요히~",
  "keyword.control.loop.while.hn": "요이이이~",
  "keyword.control.loop.break.hn": "줴줴이야",
  "keyword.control.loop.continue.hn": "아뇨",
  "storage.type.function.hn": "티-원",
  "storage.type.function.async.hn": "티~원",
  "keyword.control.flow.await.hn": "티~원!",
  "keyword.control.flow.return.hn": "아! 줴줴이야~",
  "keyword.control.flow.throw.hn": "아... 줴줴이야...",
  "keyword.control.trycatch.try.hn": "진~지?",
  "keyword.control.trycatch.catch.hn": "지~랄",
  "storage.type.class.hn": "오호호호호~",
  "storage.type.class.extends.hn": "오호호호홋~",
  "support.function.console.log.hn": "무슨 발언이세요?",
  "support.function.confirm.hn": "예? 무슨 발언이세요?",
}

// 템플릿 ${} 안에서 칠할 수 있는 값 위치 키워드
const valueMemeScopes = new Set(["keyword.control.flow.await.hn", "support.function.confirm.hn"])

// 이름 칠하기 같은 보조 scope (키워드 글자가 아님)
const helperScopes = new Set([
  "source.hn",
  "comment.line.triple-dot.hn",
  "entity.name.function.hn",
  "entity.name.type.class.hn",
  "entity.other.inherited-class.hn",
])

// 코드 위치에 남으면 안 되는 키워드 형태 (공백 경계 규칙을 지키는 일반 식별자 엄·엄마·아뇨값은 걸리지 않음)
const memePattern =
  /(?<![_$\p{L}\p{N}.])(?:예\?|요이~|요히~|요이이이~|티-원|티~원|진~지\?|지~랄|오호호호[호홋]~|무슨 발언이세요\?|줴줴이야|아뇨(?![_$\p{L}\p{N}])|엄\.{1,3}(?=\s)|엄(?=[ \t]+[_$\p{L}[{]))/u

function memeScopeOf(token: Token): string | undefined {
  return token.scopes.find((scope) => scope.endsWith(".hn") && !helperScopes.has(scope))
}

function isInStringOrComment(token: Token): boolean {
  return token.scopes.some((scope) => /^(string|comment)\./.test(scope) && !scope.endsWith(".hn"))
}

function isInTemplateExpression(token: Token): boolean {
  return token.scopes.includes("meta.template.expression.js")
}

// 키워드 토큰만 "줄 글자 → scope" 형태로 모은다
function memeTokens(tokens: Token[]): string[] {
  return tokens.flatMap((token) => {
    const scope = memeScopeOf(token)
    return scope ? [`${token.line} ${token.text} → ${scope}`] : []
  })
}

function scopeOf(tokens: Token[], text: string, nth = 0): string[] {
  const found = tokens.filter((token) => token.text === text)[nth]
  if (!found) throw new Error(`토큰 "${text}"(${nth})이 없음`)
  return found.scopes
}

// 각 줄에서 JS 코드로 칠해진(문자열·주석·키워드가 아닌) 글자만 남기고 나머지는 공백으로 가린다
function plainCodeLines(tokens: Token[]): Map<number, string> {
  const lines = new Map<number, string>()
  for (const token of tokens) {
    const visible = memeScopeOf(token) || isInStringOrComment(token) || token.scopes.includes("comment.line.triple-dot.hn")
    lines.set(token.line, (lines.get(token.line) ?? "") + (visible ? " ".repeat(token.text.length) : token.text))
  }
  return lines
}

function hnFiles(): string[] {
  const fixtureDir = `${repoRoot}packages/core/test/fixtures/`
  const exampleDir = `${repoRoot}examples/todo/`
  const fixtures = readdirSync(fixtureDir)
    .filter((name) => name.endsWith(".hn"))
    .map((name) => `packages/core/test/fixtures/${name}`)
  const examples = readdirSync(exampleDir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".hn") && !name.includes("node_modules"))
    // Windows의 readdir는 경로를 \로 이어 준다. 테스트 이름(스냅샷 키)이 OS마다 같도록 /로 맞춘다
    .map((name) => `examples/todo/${name.replaceAll("\\", "/")}`)
  return [...fixtures, ...examples].sort()
}

describe("fixture와 예제 .hn 파일", () => {
  const files = hnFiles()

  test("검사할 파일이 있다", () => {
    expect(files.length).toBeGreaterThanOrEqual(13)
  })

  test.each(files)("%s", async (file) => {
    const tokens = await tokenize(readFileSync(`${repoRoot}${file}`, "utf8"))

    for (const token of tokens) {
      const scope = memeScopeOf(token)
      if (!scope) continue
      // 키워드 scope는 정확히 그 키워드 글자에만 붙는다
      expect(memeTexts[scope], `${token.line}줄 ${scope}`).toBe(token.text)
      // 문자열·주석 안에서는 키워드를 칠하지 않는다. 템플릿 ${} 안의 값 위치 키워드만 예외
      if (isInStringOrComment(token)) {
        expect(isInTemplateExpression(token) && valueMemeScopes.has(scope), `${token.line}줄 "${token.text}"`).toBe(true)
      }
    }

    // 코드 위치의 키워드가 JS 색으로 새지 않았는지 확인
    for (const [line, code] of plainCodeLines(tokens)) {
      expect(code.match(memePattern)?.[0], `${line}줄: ${code}`).toBeUndefined()
    }

    expect(memeTokens(tokens)).toMatchSnapshot()
  })
})

describe("가장 긴 형태 우선", () => {
  test("예??? > 예?? > 예?", async () => {
    const tokens = await tokenize("예??? 값 {\n}\n예? a {\n} 예?? b {\n}")
    expect(memeTokens(tokens)).toEqual([
      "1 예??? → keyword.control.conditional.switch.hn",
      "3 예? → keyword.control.conditional.if.hn",
      "4 예?? → keyword.control.conditional.else-if.hn",
    ])
  })

  test("엄... > 엄.. > 엄. > 엄", async () => {
    const tokens = await tokenize("엄... 주석\n엄.. a = 1\n엄. b = 2\n엄 c = 3")
    expect(memeTokens(tokens)).toEqual([
      "1 엄... → punctuation.definition.comment.hn",
      "2 엄.. → storage.type.const.hn",
      "3 엄. → storage.type.let.hn",
      "4 엄 → storage.type.var.hn",
    ])
    expect(scopeOf(tokens, " 주석")).toContain("comment.line.triple-dot.hn")
  })

  test("아뇨아뇨아뇨아뇨 > 아뇨", async () => {
    const tokens = await tokenize("} 아뇨아뇨아뇨아뇨 {\n  아뇨\n}")
    expect(memeTokens(tokens)).toEqual([
      "1 아뇨아뇨아뇨아뇨 → keyword.control.conditional.else.hn",
      "2 아뇨 → keyword.control.loop.continue.hn",
    ])
  })

  test("티~원! > 티~원, 그리고 티-원", async () => {
    const tokens = await tokenize("티~원 가져오기() {\n  엄.. x = 티~원! f()\n}\n티-원 계산() {}")
    expect(memeTokens(tokens)).toEqual([
      "1 티~원 → storage.type.function.async.hn",
      "2 엄.. → storage.type.const.hn",
      "2 티~원! → keyword.control.flow.await.hn",
      "4 티-원 → storage.type.function.hn",
    ])
    expect(scopeOf(tokens, "가져오기")).toContain("entity.name.function.hn")
    expect(scopeOf(tokens, "계산")).toContain("entity.name.function.hn")
  })

  test("예? 무슨 발언이세요? > 예? (confirm), 그리고 예? 예? 무슨 발언이세요?", async () => {
    const tokens = await tokenize('예? 예? 무슨 발언이세요?("지울까요?") {\n  무슨 발언이세요? "지움"\n}')
    expect(memeTokens(tokens)).toEqual([
      "1 예? → keyword.control.conditional.if.hn",
      "1 예? 무슨 발언이세요? → support.function.confirm.hn",
      "2 무슨 발언이세요? → support.function.console.log.hn",
    ])
  })

  test("아! 줴줴이야~, 아... 줴줴이야... > 줴줴이야", async () => {
    const tokens = await tokenize('아! 줴줴이야~ 1\n아... 줴줴이야... "실패"\n줴줴이야')
    expect(memeTokens(tokens)).toEqual([
      "1 아! 줴줴이야~ → keyword.control.flow.return.hn",
      "2 아... 줴줴이야... → keyword.control.flow.throw.hn",
      "3 줴줴이야 → keyword.control.loop.break.hn",
    ])
  })
})

describe("공백 경계", () => {
  test("엄.length, 엄 = 1, 엄마, 아뇨값은 일반 식별자", async () => {
    const tokens = await tokenize("엄.length\n엄 = 1\n엄마 = 2\n아뇨값 = 3\n엄.. 아뇨값2 = 아뇨값")
    expect(memeTokens(tokens)).toEqual(["5 엄.. → storage.type.const.hn"])
    expect(scopeOf(tokens, "엄")).toContain("variable.other.object.js")
    expect(scopeOf(tokens, "엄마")).toContain("variable.other.readwrite.js")
    expect(scopeOf(tokens, "아뇨값")).toContain("variable.other.readwrite.js")
  })

  test("요이~ 등은 뒤에 공백이 있어야 키워드", async () => {
    const tokens = await tokenize("요이~ x 목록 {\n}\n요히~ k 객체 {\n}\n요이이이~ 참 {\n}")
    expect(memeTokens(tokens)).toEqual([
      "1 요이~ → keyword.control.loop.for-of.hn",
      "3 요히~ → keyword.control.loop.for-in.hn",
      "5 요이이이~ → keyword.control.loop.while.hn",
    ])
    expect(memeTokens(await tokenize("요이~x\n오호호호호~A {}"))).toEqual([])
  })

  test("멤버 접근 뒤의 키워드 글자는 칠하지 않는다", async () => {
    expect(memeTokens(await tokenize("객체.아뇨\n객체.줴줴이야\n객체.엄 = 1"))).toEqual([])
  })

  test("정해진 개수에서 벗어난 형태는 칠하지 않는다", async () => {
    expect(memeTokens(await tokenize("예???? x\n아뇨아뇨 {\n요이이~ x {\n"))).toEqual([])
  })
})

describe("클래스", () => {
  test("오호호호호~, 오호호호홋~ 와 이름", async () => {
    const tokens = await tokenize("오호호호호~ 할일 {\n}\n오호호호홋~ 마감할일 할일 {\n}")
    expect(memeTokens(tokens)).toEqual([
      "1 오호호호호~ → storage.type.class.hn",
      "3 오호호호홋~ → storage.type.class.extends.hn",
    ])
    expect(scopeOf(tokens, "할일", 0)).toContain("entity.name.type.class.hn")
    expect(scopeOf(tokens, "마감할일")).toContain("entity.name.type.class.hn")
    expect(scopeOf(tokens, "할일", 1)).toContain("entity.other.inherited-class.hn")
  })
})

describe("문자열·주석·정규식·템플릿", () => {
  test("문자열·주석·정규식 안의 키워드 글자는 칠하지 않는다", async () => {
    const source = [
      '"엄.. 예? 무슨 발언이세요? 아! 줴줴이야~ 티~원!"',
      "'진~지? 지~랄 오호호호호~'",
      "// 요이~ 아뇨아뇨아뇨아뇨 티-원",
      "/* 예??? 줴줴이야",
      "   엄... 무슨 발언이세요? */",
      "엄.. r = /예?? 아뇨+/g",
    ].join("\n")
    expect(memeTokens(await tokenize(source))).toEqual(["6 엄.. → storage.type.const.hn"])
  })

  test("템플릿 글자는 칠하지 않고 ${} 안의 값 위치 키워드는 칠한다", async () => {
    const tokens = await tokenize("무슨 발언이세요? `예? 티~원! ${티~원! 개수()} ${예? 무슨 발언이세요?(\"확인\")}`")
    expect(memeTokens(tokens)).toEqual([
      "1 무슨 발언이세요? → support.function.console.log.hn",
      "1 티~원! → keyword.control.flow.await.hn",
      "1 예? 무슨 발언이세요? → support.function.confirm.hn",
    ])
  })

  test("${} 안에서도 문자열 안의 키워드 글자와 문장 키워드는 칠하지 않는다", async () => {
    const tokens = await tokenize('`${"티~원!"} ${엄.. x} ${a ? "예?" : `아뇨 ${티~원! b}`}`')
    expect(memeTokens(tokens)).toEqual(["1 티~원! → keyword.control.flow.await.hn"])
    // 칠해진 티~원!은 바깥 템플릿 안의 안쪽 템플릿 ${} 안에 있다
    const awaitToken = tokens.find((token) => memeScopeOf(token) === "keyword.control.flow.await.hn")
    expect(awaitToken?.scopes.filter((scope) => scope === "string.template.js")).toHaveLength(2)
  })

  test("템플릿을 세 번 중첩해도 가장 안쪽 ${} 안의 티~원!을 칠한다", async () => {
    const tokens = await tokenize("`1 ${`2 ${`3 ${티~원! x} 티~원!`}`}`")
    expect(memeTokens(tokens)).toEqual(["1 티~원! → keyword.control.flow.await.hn"])
  })

  test("엄... 주석 안의 키워드 글자는 칠하지 않는다", async () => {
    const tokens = await tokenize("엄... 예? 요이~ 티~원! 아뇨\n엄.. a = 1")
    expect(memeTokens(tokens)).toEqual([
      "1 엄... → punctuation.definition.comment.hn",
      "2 엄.. → storage.type.const.hn",
    ])
  })

  test("블록·괄호 안에서도 키워드를 칠한다", async () => {
    const tokens = await tokenize("예? 목록.some(x => {\n  아! 줴줴이야~ x > 1\n}) {\n  { 무슨 발언이세요? [x] }\n}")
    expect(memeTokens(tokens)).toEqual([
      "1 예? → keyword.control.conditional.if.hn",
      "2 아! 줴줴이야~ → keyword.control.flow.return.hn",
      "4 무슨 발언이세요? → support.function.console.log.hn",
    ])
  })
})
