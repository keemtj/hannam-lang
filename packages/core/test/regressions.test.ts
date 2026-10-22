import { describe, expect, it } from "vitest"
import { compile } from "../src/index.js"
import { __hn } from "../src/runtime.js"

// 독립 리뷰에서 재현된 문제들. 번호는 리뷰 보고서의 항목 번호
const code = (src: string) => compile(src).code.replace(/\nimport \{ __hn \} from .*\n$/, "")

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>
async function run(src: string): Promise<unknown[]> {
  const logs: unknown[] = []
  await new AsyncFunction("__hn", "console", code(src))(__hn, { log: (v: unknown) => logs.push(v) })
  return logs
}

describe("리뷰 회귀 테스트", () => {
  it("H1: 지~랄 뒤 구조분해는 catch 변수가 된다", async () => {
    const src = '진~지? {\n  무슨 발언이세요? "정상"\n} 지~랄 { message } {\n  무슨 발언이세요? "에러"\n}'
    expect(code(src)).toBe('try {\n  console.log("정상")\n} catch ({ message }) {\n  console.log("에러")\n}')
    expect(await run(src)).toEqual(["정상"])
    expect(code("진~지? {\n} 지~랄 [a] {\n}")).toBe("try {\n} catch ([a]) {\n}")
  })

  it("H2: 무슨 발언이세요?의 값이 여러 줄로 이어진다", () => {
    expect(code("무슨 발언이세요? 목록\n  .map(x => x * 2)\n  .length")).toBe("console.log(목록\n  .map(x => x * 2)\n  .length)")
    expect(code("무슨 발언이세요? a,\n  b")).toBe("console.log(a,\n  b)")
    expect(code("무슨 발언이세요? a +\n  b\n엄.. c = 1")).toBe("console.log(a +\n  b)\nconst c = 1")
    expect(code('아... 줴줴이야... 값\n  ?? "기본"')).toBe('throw __hn.toError(값\n  ?? "기본")')
  })

  it("H3: 갈래 값과 범위 끝값은 연산자가 있으면 괄호로 감싼다", async () => {
    expect(await run('예??? 5 { 1 || 5 { 무슨 발언이세요? "갈래" } 아뇨아뇨아뇨아뇨 { 무슨 발언이세요? "기본" } }')).toEqual(["기본"])
    expect(await run('예??? 2 { 1 | 2 { 무슨 발언이세요? "갈래" } 아뇨아뇨아뇨아뇨 { 무슨 발언이세요? "기본" } }')).toEqual(["기본"])
    expect(code('예??? x {\n  c ? 1 : 2, a ?? b {\n  }\n  -1, 팀.이름, "a" {\n  }\n}')).toBe(
      '{ const __hn_s0 = x;\n  if (__hn_s0 === (c ? 1 : 2) || __hn_s0 === (a ?? b)) {\n  }\n  else if (__hn_s0 === -1 || __hn_s0 === 팀.이름 || __hn_s0 === "a") {\n  }\n}',
    )
    expect(code("요이~ i 0..n || 10 {\n}")).toBe("for (let i = 0; i < (n || 10); i++) {\n}")
    expect(await run("엄.. n = 0\n요이~ i 0..n || 3 {\n  무슨 발언이세요? i\n}")).toEqual([0, 1, 2])
  })

  it("M1·M2: 여러 줄 헤더의 이어지는 줄은 문장 시작이 아니다", () => {
    expect(code('예??? x {\n  "a",\n  "b" {\n    f()\n  }\n}')).toBe('{ const __hn_s0 = x;\n  if (__hn_s0 === "a" || __hn_s0 === "b") {\n    f()\n  }\n}')
    expect(code('예? 준비 &&\n  예? 무슨 발언이세요?("q") {\n  f()\n}')).toBe('if (준비 &&\n  __hn.confirm("q")) {\n  f()\n}')
  })

  it("M3: 헤더 끝 줄 주석과 다음 줄의 { (Allman 스타일)", () => {
    expect(code("예? a // 설명\n{\n  f()\n}")).toBe("if (a) // 설명\n{\n  f()\n}")
    expect(code("요이~ x xs // 설명\n{\n}")).toBe("for (const x of xs) // 설명\n{\n}")
  })

  it("M4·M5: 후위 증감과 프로퍼티 이름 뒤의 /는 나눗셈이다", () => {
    expect(code("엄.. a = i++ / 2; 엄.. b = c / 3")).toBe("const a = i++ / 2; const b = c / 3")
    expect(code("엄.. a = obj.of / 2\n엄.. b = x.return / y.in")).toBe("const a = obj.of / 2\nconst b = x.return / y.in")
    expect(code("엄.. o = { class: 1 }\n엄.. r = o.class / 2")).toBe("const o = { class: 1 }\nconst r = o.class / 2")
  })

  it("M6: 객체 리터럴의 키는 밈으로 바꾸지 않고, static 블록 안은 바꾼다", () => {
    expect(code("export default {\n  아뇨: 1,\n}")).toBe("export default {\n  아뇨: 1,\n}")
    expect(code("엄.. o =\n{\n  아뇨: 1\n}")).toBe("const o =\n{\n  아뇨: 1\n}")
    expect(code("오호호호호~ A {\n  static {\n    무슨 발언이세요? 1\n  }\n}")).toBe("class A {\n  static {\n    console.log(1)\n  }\n}")
  })

  it("L4: 클래스 본문과 객체 안의 줄 맨 앞 엄...도 주석이다", () => {
    expect(code("오호호호호~ A {\n  엄... 생성자\n  constructor() {}\n}")).toBe("class A {\n  // 생성자\n  constructor() {}\n}")
    expect(code("엄.. o = {\n  엄... 키 설명\n  a: 1,\n}")).toBe("const o = {\n  // 키 설명\n  a: 1,\n}")
  })

  it("L5·L6·L7·L8: 경계 처리", () => {
    expect(code("무슨 발언이세요?;")).toBe("console.log();")
    expect(code("요이이이~ (x) {\n}")).toBe("while (x) {\n}")
    expect(code('const s = "a\\\r\nb"')).toBe('const s = "a\\\r\nb"')
    expect(code("예??? x {\n  티~원! f() {\n  }\n}")).toBe("{ const __hn_s0 = x;\n  if (__hn_s0 === (await f())) {\n  }\n}")
  })
})

describe("재검증 회귀 테스트", () => {
  it("N1: JS switch의 case 아래 밈도 바꾸고, 줄 끝 :인 삼항식은 이어 읽는다", () => {
    expect(code("switch (x) {\n  case 1:\n    무슨 발언이세요? 1\n    break\n  default:\n    무슨 발언이세요? 2\n}")).toBe(
      "switch (x) {\n  case 1:\n    console.log(1)\n    break\n  default:\n    console.log(2)\n}",
    )
    expect(code("무슨 발언이세요? a ?\n  b :\n  c\n엄.. d = 1")).toBe("console.log(a ?\n  b :\n  c)\nconst d = 1")
  })

  it("N2: 템플릿과 갈래 맨 앞의 일반 식별자는 키워드가 아니다", () => {
    expect(code("무슨 발언이세요? `${엄.a}`")).toBe("console.log(`${엄.a}`)")
    expect(code("무슨 발언이세요? `${아뇨값}개`")).toBe("console.log(`${아뇨값}개`)")
    expect(code("무슨 발언이세요? `${엄 + 1}`")).toBe("console.log(`${엄 + 1}`)")
    expect(code("예??? x {\n  아뇨값, 엄.a {\n  }\n}")).toBe("{ const __hn_s0 = x;\n  if (__hn_s0 === 아뇨값 || __hn_s0 === 엄.a) {\n  }\n}")
  })

  it("N3: 다음 줄이 =>로 시작해도 console.log 인자에 붙이지 않는다", () => {
    expect(code("무슨 발언이세요? a\n엄.. f = 1")).toBe("console.log(a)\nconst f = 1")
    expect(code("무슨 발언이세요? a\n=> b")).toBe("console.log(a)\n=> b")
  })
})

describe("명세 변형 에러의 경계", () => {
  it("물결 없는 밈과 닮은 일반 식별자는 그대로 둔다", () => {
    expect(code("지랄 = 1")).toBe("지랄 = 1")
    expect(code("엄.. 아뇨값 = 1")).toBe("const 아뇨값 = 1")
    expect(code("오호호 = 3")).toBe("오호호 = 3")
  })
})
