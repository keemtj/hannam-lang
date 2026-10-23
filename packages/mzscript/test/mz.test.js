import { mkdirSync, readFileSync, symlinkSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { MZ, MZC, PKG_DIR, cleanup, node, project } from "./helpers.js"

afterEach(cleanup)

describe("mzscript", () => {
  it(".mz 파일끼리 import하는 프로젝트를 실행하고 인자를 넘긴다", () => {
    const root = project({
      "main.mz": `import { 더하기 } from "./lib/math.mz"
엄.. [a, b] = process.argv.slice(2).map(Number)
무슨 발언이세요? 더하기(a, b)
무슨 발언이세요? process.argv[1].endsWith("main.mz")
`,
      "lib/math.mz": `export 티-원 더하기(a, b) {
  아! 줴줴이야~ a + b
}
`,
    })
    const r = node([MZ, "main.mz", "2", "3"], root)
    expect(r.stderr).toBe("")
    expect(r.status).toBe(0)
    expect(r.stdout).toBe("5\ntrue\n")
  })

  it("top-level 티~원!을 쓸 수 있다", () => {
    const root = project({ "main.mz": `엄.. 값 = 티~원! Promise.resolve("요이~")\n무슨 발언이세요? 값\n` })
    expect(node([MZ, "main.mz"], root).stdout).toBe("요이~\n")
  })

  it("컴파일 에러는 위치와 코드 조각만 stderr에 쓰고 종료 코드 1", () => {
    const root = project({
      "main.mz": `import "./bad.mz"\n`,
      "bad.mz": `엄.. x = 1\n예???? x {\n}\n`,
    })
    const r = node([MZ, "main.mz"], root)
    expect(r.status).toBe(1)
    expect(r.stdout).toBe("")
    expect(r.stderr).toContain(`bad.mz:2:1`)
    expect(r.stderr).toContain("2 | 예???? x {\n    ^")
    expect(r.stderr).not.toMatch(/^\s+at /m)
  })

  it("런타임 에러 스택은 .mz 원본의 줄을 가리킨다", () => {
    const root = project({
      "main.mz": `import { 터뜨리기 } from "./boom.mz"
엄... 주석

터뜨리기()
`,
      "boom.mz": `엄... 첫 줄
엄... 둘째 줄
export 티-원 터뜨리기() {
  엄.. 메시지 = "터짐"
  아... 줴줴이야... 메시지
}
`,
    })
    const r = node([MZ, "main.mz"], root)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("Error: 터짐")
    expect(r.stderr).toMatch(/boom\.mz:5:\d+/)
    expect(r.stderr).toMatch(/main\.mz:4:\d+/)
  })

  it("사용자 프로젝트에 mzscript가 없어도 런타임 헬퍼를 쓴다", () => {
    const root = project({
      "main.mz": `진~지? {
  엄.. 값 = "문자열 에러"
  아... 줴줴이야... 값
} 지~랄 e {
  무슨 발언이세요? e instanceof Error, e.message
}
`,
    })
    const r = node([MZ, "main.mz"], root)
    expect(r.stderr).toBe("")
    expect(r.stdout).toBe("true 문자열 에러\n")
  })

  it("없는 파일, 알 수 없는 옵션, 인자 없음은 종료 코드 1", () => {
    const root = project({})
    expect(node([MZ, "없음.mz"], root).status).toBe(1)
    expect(node([MZ, "--wat"], root).status).toBe(1)
    expect(node([MZ], root).status).toBe(1)
  })

  it("--version과 --help", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
    expect(node([MZ, "--version"]).stdout.trim()).toBe(pkg.version)
    expect(node([MZ, "-v"]).stdout.trim()).toBe(pkg.version)
    const help = node([MZ, "--help"])
    expect(help.status).toBe(0)
    expect(help.stdout).toContain("사용법: mz")
  })
})

describe("패키지 exports", () => {
  /** mzscript를 의존성으로 설치한 것처럼 node_modules에 링크한 프로젝트 */
  function linkedProject(/** @type {Record<string, string>} */ files) {
    const root = project({ ...files, "package.json": `{ "type": "module" }` })
    mkdirSync(join(root, "node_modules"))
    symlinkSync(PKG_DIR, join(root, "node_modules/mzscript"), "dir")
    return root
  }

  it("mzscript/runtime은 core 런타임의 __mz를 내보낸다", async () => {
    const runtime = await import("mzscript/runtime")
    const core = await import("@mzscript/core/runtime")
    expect(runtime.__mz).toBe(core.__mz)
    expect(runtime.__mz.toError("x")).toBeInstanceOf(Error)
  })

  it("mzscript 본체는 core API를 내보낸다", async () => {
    const { compile, MzScriptSyntaxError } = await import("mzscript")
    expect(compile(`엄.. x = 1`).code).toBe("const x = 1")
    expect(() => compile("예???? x {}")).toThrow(MzScriptSyntaxError)
  })

  it("mzc 출력의 mzscript/runtime import가 설치된 패키지로 풀린다", () => {
    const root = linkedProject({
      "main.mz": `import { 확인 } from "./util.mz"\n무슨 발언이세요? 확인("x")\n`,
      "util.mz": `export 티-원 확인(값) {\n  진~지? {\n    아... 줴줴이야... 값\n  } 지~랄 e {\n    아! 줴줴이야~ e instanceof Error\n  }\n}\n`,
    })
    expect(node([MZC, "."], root).status).toBe(0)
    const r = node(["main.js"], root)
    expect(r.stderr).toBe("")
    expect(r.stdout).toBe("true\n")
  })

  it("node --import mzscript/register로 .mz를 실행한다", () => {
    const root = linkedProject({
      "main.mz": `import { 값 } from "./b.mz"\n무슨 발언이세요? 값\n`,
      "b.mz": `export 엄.. 값 = "요히~"\n`,
    })
    const r = node(["--import", "mzscript/register", "main.mz"], root)
    expect(r.stderr).toBe("")
    expect(r.stdout).toBe("요히~\n")
  })
})
