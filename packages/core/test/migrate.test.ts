import { readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { parse } from "acorn"
import { describe, expect, it } from "vitest"
import { compile } from "../src/index.js"
import { MigrateError, migrate } from "../src/migrate.js"

const code = (js: string, options?: Parameters<typeof migrate>[1]) => migrate(js, options).code
const skippedKinds = (js: string) => migrate(js).skipped.map((s) => s.kind)

describe("migrate: 항상 바꾸는 것", () => {
  it("변수 선언", () => {
    expect(code("var a = 1\nlet b = 2\nconst c = 3")).toBe("엄 a = 1\n엄. b = 2\n엄.. c = 3")
    expect(code("const { a, b } = o")).toBe("엄.. { a, b } = o")
  })

  it("if · else if · else", () => {
    expect(code("if (a) {\n  x()\n} else if (b) {\n  y()\n} else {\n  z()\n}")).toBe(
      "예? a {\n  x()\n} 예?? b {\n  y()\n} 아뇨아뇨아뇨아뇨 {\n  z()\n}",
    )
  })

  it("조건에 {가 있으면 괄호를 남긴다", () => {
    expect(code("if (list.some((x) => { return x })) {\n  y()\n}")).toBe("예? (list.some((x) => { 아! 줴줴이야~ x })) {\n  y()\n}")
  })

  it("이중 괄호 조건은 바깥 괄호만 벗긴다", () => {
    expect(code("if ((a ? b : c)) {\n  x()\n} else if ((d)) {\n  y()\n}")).toBe("예? (a ? b : c) {\n  x()\n} 예?? (d) {\n  y()\n}")
    expect(code("while ((m = re.exec(s))) {\n  f(m)\n}")).toBe("요이이이~ (m = re.exec(s)) {\n  f(m)\n}")
  })

  it("while, break, continue", () => {
    expect(code("while (n > 0) {\n  if (a) {\n    break\n  }\n  continue\n}")).toBe(
      "요이이이~ n > 0 {\n  예? a {\n    줴줴이야\n  }\n  아뇨\n}",
    )
  })

  it("함수, async, await, return", () => {
    expect(code("async function f() {\n  return await g()\n}\nfunction h() {\n  return\n}")).toBe(
      "티~원 f() {\n  아! 줴줴이야~ 티~원! g()\n}\n티-원 h() {\n  아! 줴줴이야~\n}",
    )
  })

  it("export 뒤의 선언", () => {
    expect(code("export function f() {}\nexport const a = 1\nexport default class A {}")).toBe(
      "export 티-원 f() {}\nexport 엄.. a = 1\nexport default 오호호호호~ A {}",
    )
  })

  it("클래스와 상속", () => {
    expect(code("class A {}\nclass B extends A {}")).toBe("오호호호호~ A {}\n오호호호홋~ B A {}")
  })

  it("try · catch (finally는 JS 그대로)", () => {
    expect(code("try {\n  a()\n} catch (e) {\n  b(e)\n} finally {\n  c()\n}")).toBe(
      "진~지? {\n  a()\n} 지~랄 e {\n  b(e)\n} finally {\n  c()\n}",
    )
    expect(code("try {\n  a()\n} catch {\n  b()\n}")).toBe("진~지? {\n  a()\n} 지~랄 {\n  b()\n}")
  })

  it("console.log", () => {
    expect(code('console.log("a", b)\nconsole.log()')).toBe('무슨 발언이세요? "a", b\n무슨 발언이세요?')
  })

  it("confirm과 window.confirm", () => {
    expect(code('const ok = confirm("지울까요?")\nif (window.confirm("정말?")) {\n  x()\n}')).toBe(
      '엄.. ok = 예? 무슨 발언이세요?("지울까요?")\n예? 예? 무슨 발언이세요?("정말?") {\n  x()\n}',
    )
  })

  it("throw new", () => {
    expect(code('throw new Error("실패")')).toBe('아... 줴줴이야... new Error("실패")')
  })

  it("서식은 그대로 둔다 (세미콜론, 따옴표, 들여쓰기, CRLF)", () => {
    expect(code("const a = 'x';\r\nif (a) {\r\n\tf();\r\n}\r\n")).toBe("엄.. a = 'x';\r\n예? a {\r\n\tf();\r\n}\r\n")
  })
})

describe("migrate: 조건이 맞을 때만 바꾸는 것", () => {
  it("for...of와 for...in은 const일 때만", () => {
    expect(code("for (const x of xs) {\n  f(x)\n}\nfor (const k in o) {\n  g(k)\n}")).toBe(
      "요이~ x xs {\n  f(x)\n}\n요히~ k o {\n  g(k)\n}",
    )
    expect(code("for (let x of xs) {\n  x = 1\n}")).toBe("for (let x of xs) {\n  x = 1\n}")
    expect(skippedKinds("for (let x of xs) {\n  x = 1\n}")).toEqual(["for...of"])
  })

  it("구조분해 반복 변수", () => {
    expect(code("for (const [k, v] of Object.entries(o)) {\n  f(k, v)\n}")).toBe("요이~ [k, v] Object.entries(o) {\n  f(k, v)\n}")
  })

  it("범위 for는 let i = a; i < b; i++ 형태만", () => {
    expect(code("for (let i = 0; i < xs.length; i++) {\n  f(i)\n}")).toBe("요이~ i 0..xs.length {\n  f(i)\n}")
    expect(code("for (let i = 0; i <= n; i++) {\n  f(i)\n}")).toBe("for (let i = 0; i <= n; i++) {\n  f(i)\n}")
    expect(code("for (let i = 0; i < n; i += 2) {\n  f(i)\n}")).toBe("for (let i = 0; i < n; i += 2) {\n  f(i)\n}")
  })

  it("switch: 빈 case는 묶고, 마지막 break는 } 로", () => {
    const js = [
      "switch (f) {",
      "  case 1:",
      "    a()",
      "    break",
      "  case 2:",
      "  case 3:",
      "    b()",
      "    break",
      "  default:",
      "    c()",
      "}",
    ].join("\n")
    expect(code(js)).toBe(
      ["예??? f {", "  1 {", "    a()", "  }", "  2,", "  3 {", "    b()", "  }", "  아뇨아뇨아뇨아뇨 {", "    c()", "  }", "}"].join("\n"),
    )
  })

  it("switch: fallthrough, 중간 break, 블록 case, default가 마지막이 아니면 그대로", () => {
    const keep = [
      "switch (f) {\n  case 1:\n    a()\n  case 2:\n    b()\n    break\n}",
      "switch (f) {\n  case 1:\n    if (x) {\n      break\n    }\n    a()\n    break\n}",
      "switch (f) {\n  case 1: {\n    a()\n    break\n  }\n}",
      "switch (f) {\n  default:\n    a()\n    break\n  case 1:\n    b()\n    break\n}",
    ]
    for (const js of keep) {
      expect(migrate(js).code.startsWith("switch")).toBe(true)
      expect(skippedKinds(js)).toContain("switch")
    }
  })

  it("switch: 다른 case에서 쓰는 이름을 선언하면 그대로", () => {
    const js = "switch (f) {\n  case 1:\n    let a = 1\n    break\n  case 2:\n    a = 2\n    break\n}"
    expect(migrate(js).code.startsWith("switch")).toBe(true)
  })

  it("switch: return으로 끝나는 case는 fallthrough가 아니다", () => {
    const js = 'function label(f) {\n  switch (f) {\n    case "done":\n      return "완료"\n    default:\n      return "할 일"\n  }\n}'
    expect(code(js)).toBe(
      '티-원 label(f) {\n  예??? f {\n    "done" {\n      아! 줴줴이야~ "완료"\n    }\n    아뇨아뇨아뇨아뇨 {\n      아! 줴줴이야~ "할 일"\n    }\n  }\n}',
    )
  })

  it("switch의 마지막 문장이 레이블 break면 그대로 남긴다", () => {
    const js = "loop: for (;;) {\n  switch (c) {\n    case 1:\n      a()\n      break\n    default:\n      break loop\n  }\n}"
    expect(code(js)).toBe(
      "loop: for (;;) {\n  예??? c {\n    1 {\n      a()\n    }\n    아뇨아뇨아뇨아뇨 {\n      break loop\n    }\n  }\n}",
    )
  })

  it("switch: case 조건이 case 안에서 선언한 이름을 쓰면 그대로 (스코프가 달라짐)", () => {
    // 끌어올린 function: JS에서는 case 조건의 f()가 case 2의 f를 부른다
    const hoisted = 'function g(v) {\n  switch (v) {\n    case f():\n      a()\n      break\n    case 2:\n      function f() { return 2 }\n      b()\n      break\n  }\n}'
    expect(code(hoisted)).toContain("switch (v)")
    // TDZ: JS에서는 case a가 아직 초기화되지 않은 case 1의 a를 봐서 ReferenceError가 난다
    const tdz = "function g(v) {\n  switch (v) {\n    case 1:\n      const a = 5\n      f(a)\n      break\n    case a:\n      h()\n      break\n  }\n}"
    expect(code(tdz)).toContain("switch (v)")
  })

  it("switch: 마지막 case 뒤에 넣는 }도 CRLF를 따른다", () => {
    expect(code("switch (x) {\r\n  case 1:\r\n    f()\r\n    break\r\n  default:\r\n    g()\r\n}\r\n")).toBe(
      "예??? x {\r\n  1 {\r\n    f()\r\n  }\r\n  아뇨아뇨아뇨아뇨 {\r\n    g()\r\n  }\r\n}\r\n",
    )
  })

  it("switch 안의 반복문 break는 따로 바꾼다", () => {
    const js = "switch (f) {\n  case 1:\n    while (x) {\n      break\n    }\n    break\n}"
    expect(code(js)).toBe("예??? f {\n  1 {\n    요이이이~ x {\n      줴줴이야\n    }\n  }\n}")
  })
})

describe("migrate: 바꾸지 않는 것", () => {
  it("본문이 블록이 아닌 if, 레이블, 화살표 함수, 표현식", () => {
    const js = "if (a) b()\nouter: for (;;) {\n  break outer\n}\nconst f = () => 1\nconst g = function () {}\nconst C = class {}"
    expect(code(js)).toBe(
      "if (a) b()\nouter: for (;;) {\n  break outer\n}\n엄.. f = () => 1\n엄.. g = function () {}\n엄.. C = class {}",
    )
  })

  it("new가 아닌 throw (문자열이나 식별자는 .hn에서 동작이 달라짐)", () => {
    expect(code('throw "x"\nthrow err')).toBe('throw "x"\nthrow err')
  })

  it("여러 줄 console.log, 끝 쉼표", () => {
    expect(code("console.log(\n  a,\n  b\n)")).toBe("console.log(\n  a,\n  b\n)")
    expect(code("console.log(a, b,)")).toBe("console.log(a, b,)")
  })

  it("console과 confirm이 지역 이름으로 가려지면", () => {
    expect(code("const console = x\nconsole.log(1)")).toBe("엄.. console = x\nconsole.log(1)")
    expect(code("function f(confirm) {\n  confirm(1)\n}")).toBe("티-원 f(confirm) {\n  confirm(1)\n}")
  })

  it("__hn으로 시작하는 이름이 있으면 confirm과 switch를 바꾸지 않는다 (런타임 헬퍼·임시 변수와 겹침)", () => {
    expect(code('function f(__hn) {\n  return confirm("q")\n}')).toBe('티-원 f(__hn) {\n  아! 줴줴이야~ confirm("q")\n}')
    expect(code("const __hn_s0 = 1\nswitch (x) {\n  case 1:\n    f()\n    break\n}")).toContain("switch (x)")
  })

  it("인자 없는 confirm()은 그대로 (헬퍼가 undefined 문구를 띄움)", () => {
    expect(code("const ok = confirm()")).toBe("엄.. ok = confirm()")
  })

  it("BigInt 리터럴이 있어도 동작한다", () => {
    expect(code("const x = 1n\nif (x > 0n) {\n  f()\n}")).toBe("엄.. x = 1n\n예? x > 0n {\n  f()\n}")
  })

  it("문장 맨 앞이 아닌 문장 키워드", () => {
    expect(code("function f() {\n  if (a) return\n}")).toBe("티-원 f() {\n  if (a) return\n}")
  })

  it("for await, 제너레이터, do...while", () => {
    const js = "for await (const x of xs) {}\nfunction* g() {}\ndo {\n  a()\n} while (b)"
    expect(code(js)).toBe(js)
  })
})

describe("migrate: 주석", () => {
  const js = "// 설명\nconst a = 1 // 끝 주석\n/* 블록 */\n// eslint-disable-next-line\nconst b = 2"

  it("기본값은 주석을 그대로 둔다", () => {
    expect(code(js)).toBe("// 설명\n엄.. a = 1 // 끝 주석\n/* 블록 */\n// eslint-disable-next-line\n엄.. b = 2")
  })

  it("comments 옵션은 줄 맨 앞의 // 만 바꾸고 도구용 주석은 남긴다", () => {
    expect(code(js, { comments: true })).toBe(
      "엄... 설명\n엄.. a = 1 // 끝 주석\n/* 블록 */\n// eslint-disable-next-line\n엄.. b = 2",
    )
  })

  it("comments 옵션도 파일 맨 앞의 #!는 건드리지 않는다", () => {
    expect(code("#!node\nconsole.log(1)", { comments: true })).toBe("#!node\n무슨 발언이세요? 1")
  })

  it("식 중간 줄의 주석이 .hn에서 깨지면 그 주석만 남긴다", () => {
    const r = migrate("const a = 1 +\n  // 중간\n  2", { comments: true })
    expect(() => compile(r.code)).not.toThrow()
    expect(parse(compile(r.code).code, { ecmaVersion: "latest", sourceType: "module" }).body).toHaveLength(1)
  })
})

describe("migrate: import 경로", () => {
  it("rewriteImport가 돌려준 경로로 바꾼다", () => {
    const js = 'import a from "./a.js"\nexport * from "./b.js"\nimport x from "vite"\nconst m = import("./c.js")'
    const rewriteImport = (s: string) => (s.startsWith(".") ? s.replace(/\.js$/, ".hn") : undefined)
    expect(code(js, { rewriteImport })).toBe(
      'import a from "./a.hn"\nexport * from "./b.hn"\nimport x from "vite"\n엄.. m = import("./c.hn")',
    )
  })
})

describe("migrate: 이미 컴파일된 JS", () => {
  // fixtures/*.js는 컴파일러 출력이라 런타임 import와 __hn 헬퍼 호출이 들어 있다
  const dir = join(import.meta.dirname, "fixtures")
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    it(name, () => {
      const source = readFileSync(join(dir, name), "utf8")
      const result = migrate(source, { filename: name })
      expect(result.changes).toBeGreaterThan(0)
      expect(shape(compile(result.code).code)).toBe(shape(source))
    })
  }
})

describe("migrate: 파일째 옮길 수 없는 경우", () => {
  it("JS로 읽을 수 없으면 MigrateError", () => {
    expect(() => migrate("const a = <div />", { filename: "a.js" })).toThrow(MigrateError)
    expect(() => migrate("const a = <div />", { filename: "a.js" })).toThrow(/a\.js:1:11/)
  })

  it("CommonJS는 MigrateError, allowCommonJS면 변환", () => {
    expect(() => migrate('const fs = require("fs")')).toThrow(/CommonJS\(require\)/)
    expect(() => migrate("module.exports = 1")).toThrow(/CommonJS\(module\)/)
    expect(code('const fs = require("fs")', { allowCommonJS: true })).toBe('엄.. fs = require("fs")')
    expect(code("const o = { require: 1 }\no.require")).toBe("엄.. o = { require: 1 }\no.require")
  })

  it("문장 맨 앞에 키워드와 같은 이름이 있으면 MigrateError", () => {
    expect(() => migrate("let 아뇨 = 0\n아뇨 = 1")).toThrow(/그대로 \.hn이 될 수 없습니다/)
    expect(() => migrate("let 아뇨 = 0\n아뇨 = 1", { filename: "x.js" })).toThrow(/\(x\.js\)$/)
  })
})

// 왕복 검사: 실제 패키지 JS를 바꾼 뒤 다시 컴파일하면 원래 JS와 같은 AST가 나와야 한다.
// migrate 안에서도 같은 검증을 하지만, 여기서는 그 결과를 따로 컴파일·파싱해서 확인한다
const require = createRequire(import.meta.url)
const CORPUS = ["acorn", "magic-string", "lodash-es"]

function jsFiles(name: string): string[] {
  const dir = dirname(require.resolve(`${name}/package.json`))
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(c|m)?js$/.test(e.name))
    .map((e) => join(e.parentPath, e.name))
    .sort()
}

const PARSE = { ecmaVersion: "latest", sourceType: "module" } as const

function shape(source: string): string {
  return JSON.stringify(parse(source, PARSE), (key, value) =>
    key === "start" || key === "end" || key === "raw" ? undefined : value,
  )
}

describe("migrate: 실제 JS 왕복", () => {
  for (const name of CORPUS) {
    it(name, () => {
      let changes = 0
      let files = 0
      for (const file of jsFiles(name)) {
        const source = readFileSync(file, "utf8")
        let result: ReturnType<typeof migrate>
        try {
          result = migrate(source, { filename: file, allowCommonJS: true })
        } catch (e) {
          // 엄격 모드나 ES 모듈로 읽을 수 없는 파일은 대상이 아니다
          expect(e).toBeInstanceOf(MigrateError)
          continue
        }
        files++
        changes += result.changes
        const back = compile(result.code, { filename: file }).code
        // switch·confirm은 컴파일 결과의 모양이 달라지므로, 그런 변환이 없는 파일만 AST를 직접 비교한다
        if (!/예\?\?\?|무슨 발언이세요\?\(/.test(result.code)) {
          expect(shape(back), file).toBe(shape(source))
        } else {
          expect(() => parse(back, PARSE), file).not.toThrow()
        }
      }
      expect(files).toBeGreaterThan(0)
      expect(changes).toBeGreaterThan(0)
    })
  }
})
