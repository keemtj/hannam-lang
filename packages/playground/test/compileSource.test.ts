import { describe, expect, test } from "vitest"
import { compileSource, offsetAt, shortMessage } from "../src/compileSource"
import { EXAMPLES } from "../src/examples"

describe("compileSource", () => {
  test("성공하면 변환된 JS를 돌려준다", () => {
    const result = compileSource('엄.. 개수 = 1\n무슨 발언이세요? 개수')
    expect(result).toEqual({ ok: true, code: "const 개수 = 1\nconsole.log(개수)" })
  })

  test("confirm을 쓰면 런타임 import가 맨 끝에 붙는다", () => {
    const result = compileSource('엄.. 답 = 예? 무슨 발언이세요?("지울까요?")')
    expect(result.ok && result.code).toBe(
      'const 답 = __hn.confirm("지울까요?")\nimport { __hn } from "hannam-lang/runtime"\n',
    )
  })

  test("문법 에러는 줄·열과 에디터 밑줄 범위를 돌려준다", () => {
    const source = '무슨 발언이세요? "앞"\n  예???? 1 {\n}'
    const result = compileSource(source)
    expect(result.ok).toBe(false)
    if (result.ok) return
    const d = result.diagnostic
    expect(d.line).toBe(2)
    expect(d.column).toBe(2)
    expect(source.slice(d.from, d.to)).toBe("예????")
    expect(d.message).toBe("'예'의 물음표는 1~3개만 쓸 수 있습니다 (4개)")
    expect(d.fullMessage).toContain("playground.hn:2:3")
    expect(d.fullMessage).toContain("2 |   예???? 1 {")
  })

  test("줄 끝에서 난 에러도 한 글자 이상 밑줄을 친다", () => {
    const source = "엄.. x = 1\n무슨 발언이세요?(x)"
    const result = compileSource(source)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostic.to).toBeGreaterThan(result.diagnostic.from)
    expect(result.diagnostic.line).toBe(2)
  })

  test("예제는 모두 변환된다", () => {
    for (const example of EXAMPLES) {
      expect(compileSource(example.code), example.id).toMatchObject({ ok: true })
    }
  })
})

describe("offsetAt · shortMessage", () => {
  test("줄·열을 오프셋으로 바꾸고, 줄 길이를 넘지 않는다", () => {
    const source = "ab\ncde\nf"
    expect(offsetAt(source, 1, 0)).toBe(0)
    expect(offsetAt(source, 2, 1)).toBe(4)
    expect(offsetAt(source, 2, 99)).toBe(6)
    expect(offsetAt(source, 9, 0)).toBe(source.length)
  })

  test("위치 괄호와 코드 조각을 떼어 낸다", () => {
    expect(shortMessage("무슨 문제 (playground.hn:3:5)\n3 | 코드\n    ^")).toBe("무슨 문제")
    expect(shortMessage("위치 없는 메시지")).toBe("위치 없는 메시지")
  })
})
