import { mkdirSync, readFileSync, symlinkSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { HANNAM, HANNAMC, PKG_DIR, cleanup, node, project } from "./helpers.js"

afterEach(cleanup)

describe("hannam", () => {
  it(".hn 파일끼리 import하는 프로젝트를 실행하고 인자를 넘긴다", () => {
    const root = project({
      "main.hn": `import { 더하기 } from "./lib/math.hn"
엄.. [a, b] = process.argv.slice(2).map(Number)
무슨 발언이세요? 더하기(a, b)
무슨 발언이세요? process.argv[1].endsWith("main.hn")
`,
      "lib/math.hn": `export 티-원 더하기(a, b) {
  아! 줴줴이야~ a + b
}
`,
    })
    const r = node([HANNAM, "main.hn", "2", "3"], root)
    expect(r.stderr).toBe("")
    expect(r.status).toBe(0)
    expect(r.stdout).toBe("5\ntrue\n")
  })

  it("top-level 티~원!을 쓸 수 있다", () => {
    const root = project({ "main.hn": `엄.. 값 = 티~원! Promise.resolve("요이~")\n무슨 발언이세요? 값\n` })
    expect(node([HANNAM, "main.hn"], root).stdout).toBe("요이~\n")
  })

  it("컴파일 에러는 위치와 코드 조각만 stderr에 쓰고 종료 코드 1", () => {
    const root = project({
      "main.hn": `import "./bad.hn"\n`,
      "bad.hn": `엄.. x = 1\n예???? x {\n}\n`,
    })
    const r = node([HANNAM, "main.hn"], root)
    expect(r.status).toBe(1)
    expect(r.stdout).toBe("")
    expect(r.stderr).toContain(`bad.hn:2:1`)
    expect(r.stderr).toContain("2 | 예???? x {\n    ^")
    expect(r.stderr).not.toMatch(/^\s+at /m)
  })

  it("런타임 에러 스택은 .hn 원본의 줄을 가리킨다", () => {
    const root = project({
      "main.hn": `import { 터뜨리기 } from "./boom.hn"
엄... 주석

터뜨리기()
`,
      "boom.hn": `엄... 첫 줄
엄... 둘째 줄
export 티-원 터뜨리기() {
  엄.. 메시지 = "터짐"
  아... 줴줴이야... 메시지
}
`,
    })
    const r = node([HANNAM, "main.hn"], root)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("Error: 터짐")
    expect(r.stderr).toMatch(/boom\.hn:5:\d+/)
    expect(r.stderr).toMatch(/main\.hn:4:\d+/)
  })

  it("사용자 프로젝트에 hannam-lang이 없어도 런타임 헬퍼를 쓴다", () => {
    const root = project({
      "main.hn": `진~지? {
  엄.. 값 = "문자열 에러"
  아... 줴줴이야... 값
} 지~랄 e {
  무슨 발언이세요? e instanceof Error, e.message
}
`,
    })
    const r = node([HANNAM, "main.hn"], root)
    expect(r.stderr).toBe("")
    expect(r.stdout).toBe("true 문자열 에러\n")
  })

  it("없는 파일, 알 수 없는 옵션, 인자 없음은 종료 코드 1", () => {
    const root = project({})
    expect(node([HANNAM, "없음.hn"], root).status).toBe(1)
    expect(node([HANNAM, "--wat"], root).status).toBe(1)
    expect(node([HANNAM], root).status).toBe(1)
  })

  it("--version과 --help", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
    expect(node([HANNAM, "--version"]).stdout.trim()).toBe(pkg.version)
    expect(node([HANNAM, "-v"]).stdout.trim()).toBe(pkg.version)
    const help = node([HANNAM, "--help"])
    expect(help.status).toBe(0)
    expect(help.stdout).toContain("사용법: hannam")
  })
})

describe("패키지 exports", () => {
  /** hannam-lang을 의존성으로 설치한 것처럼 node_modules에 링크한 프로젝트 */
  function linkedProject(/** @type {Record<string, string>} */ files) {
    const root = project({ ...files, "package.json": `{ "type": "module" }` })
    mkdirSync(join(root, "node_modules"))
    symlinkSync(PKG_DIR, join(root, "node_modules/hannam-lang"), "dir")
    return root
  }

  it("hannam-lang/runtime은 core 런타임의 __hn을 내보낸다", async () => {
    const runtime = await import("hannam-lang/runtime")
    const core = await import("@hannam-lang/core/runtime")
    expect(runtime.__hn).toBe(core.__hn)
    expect(runtime.__hn.toError("x")).toBeInstanceOf(Error)
  })

  it("hannam-lang 본체는 core API를 내보낸다", async () => {
    const { compile, HannamSyntaxError } = await import("hannam-lang")
    expect(compile(`엄.. x = 1`).code).toBe("const x = 1")
    expect(() => compile("예???? x {}")).toThrow(HannamSyntaxError)
  })

  it("hannamc 출력의 hannam-lang/runtime import가 설치된 패키지로 풀린다", () => {
    const root = linkedProject({
      "main.hn": `import { 확인 } from "./util.hn"\n무슨 발언이세요? 확인("x")\n`,
      "util.hn": `export 티-원 확인(값) {\n  진~지? {\n    아... 줴줴이야... 값\n  } 지~랄 e {\n    아! 줴줴이야~ e instanceof Error\n  }\n}\n`,
    })
    expect(node([HANNAMC, "."], root).status).toBe(0)
    const r = node(["main.js"], root)
    expect(r.stderr).toBe("")
    expect(r.stdout).toBe("true\n")
  })

  it("node --import hannam-lang/register로 .hn을 실행한다", () => {
    const root = linkedProject({
      "main.hn": `import { 값 } from "./b.hn"\n무슨 발언이세요? 값\n`,
      "b.hn": `export 엄.. 값 = "요히~"\n`,
    })
    const r = node(["--import", "hannam-lang/register", "main.hn"], root)
    expect(r.stderr).toBe("")
    expect(r.stdout).toBe("요히~\n")
  })
})
