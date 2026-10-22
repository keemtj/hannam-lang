import { describe, expect, it } from "vitest"
import { collectDiagnostics } from "../src/diagnostics.ts"

describe("collectDiagnostics", () => {
  it("올바른 코드는 진단이 없다", () => {
    expect(collectDiagnostics('엄.. a = 1\n무슨 발언이세요? a\nimport b from "./b.hn"')).toEqual([])
  })

  it("컴파일 에러는 위치를 0부터 센 error 하나가 되고, 메시지에 위치·코드 조각을 붙이지 않는다", () => {
    const [d, ...rest] = collectDiagnostics("엄. a = 1\n예???? a {\n}", "t.hn")
    expect(rest).toEqual([])
    expect(d).toMatchObject({ severity: "error", line: 1, startColumn: 0, endColumn: "예????".length })
    expect(d?.message).toContain("물음표는 1~3개")
    expect(d?.message).not.toContain("t.hn:")
    expect(d?.message).not.toContain("\n")
  })

  it("확장자 없는 상대 경로 import는 warning이 되고 경로 문자열에 밑줄을 친다", () => {
    const src = 'import { a } from "./store"\nimport b from "./c"'
    const ds = collectDiagnostics(src)
    expect(ds.map((d) => [d.severity, d.line, d.startColumn, d.endColumn])).toEqual([
      ["warning", 0, 18, 18 + '"./store"'.length],
      ["warning", 1, 14, 14 + '"./c"'.length],
    ])
  })

  it("한글 앞에 있어도 칸은 UTF-16 기준이다 (VS Code Position과 같음)", () => {
    const [d] = collectDiagnostics("엄.. 목록 = 1; 예???? 목록 {\n}")
    expect(d?.startColumn).toBe("엄.. 목록 = 1; ".length)
  })

  it("줄 끝에서 난 에러도 최소 한 칸을 칠한다", () => {
    const [d] = collectDiagnostics("예? a {\n  무슨 발언이세요? 1")
    expect(d?.severity).toBe("error")
    expect(d!.endColumn - d!.startColumn).toBeGreaterThanOrEqual(1)
  })
})
