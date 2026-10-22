import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { HANNAMC, cleanup, node, project } from "./helpers.js"

afterEach(cleanup)

const MAIN = `import { 인사 } from "./util.hn"
엄.. 이름 = "한남"
무슨 발언이세요? 인사(이름)
`
const UTIL = `export 티-원 인사(이름) {
  예? !이름 {
    엄.. 에러 = "이름 없음"
    아... 줴줴이야... 에러
  }
  아! 줴줴이야~ \`요이~ \${이름}\`
}
`

describe("hannamc", () => {
  it("원본 옆에 .js와 .js.map을 만들고 import 경로를 .js로 바꾼다", () => {
    const root = project({ "main.hn": MAIN, "util.hn": UTIL })
    const r = node([HANNAMC, "main.hn", "util.hn", "--source-map"], root)
    expect(r.stderr).toBe("")
    expect(r.status).toBe(0)

    const main = readFileSync(join(root, "main.js"), "utf8")
    expect(main).toContain(`import { 인사 } from "./util.js"`)
    expect(main).toContain(`console.log(인사(이름))`)
    expect(main.trimEnd().endsWith("//# sourceMappingURL=main.js.map")).toBe(true)

    const map = JSON.parse(readFileSync(join(root, "main.js.map"), "utf8"))
    expect(map.sources).toEqual(["main.hn"])
    expect(map.file).toBe("main.js")
    expect(map.mappings).not.toBe("")

    const util = readFileSync(join(root, "util.js"), "utf8")
    expect(util).toContain(`throw __hn.toError(에러)`)
    expect(util).toContain(`import { __hn } from "hannam-lang/runtime"`)
  })

  it("--source-map 없이는 .map을 만들지 않는다", () => {
    const root = project({ "main.hn": MAIN })
    expect(node([HANNAMC, "main.hn"], root).status).toBe(0)
    expect(existsSync(join(root, "main.js"))).toBe(true)
    expect(existsSync(join(root, "main.js.map"))).toBe(false)
    expect(readFileSync(join(root, "main.js"), "utf8")).not.toContain("sourceMappingURL")
  })

  it("디렉터리를 받으면 --out-dir 아래에 구조를 유지하고 소스맵은 원본을 상대 경로로 가리킨다", () => {
    const root = project({
      "src/main.hn": MAIN,
      "src/lib/util.hn": UTIL,
      "src/node_modules/skip/x.hn": "엄.. 무시 = 1\n",
      "src/readme.txt": "hn 아님",
    })
    const r = node([HANNAMC, "src", "--out-dir", "dist", "--source-map"], root)
    expect(r.stderr).toBe("")
    expect(r.status).toBe(0)
    expect(existsSync(join(root, "dist/main.js"))).toBe(true)
    expect(existsSync(join(root, "dist/lib/util.js"))).toBe(true)
    expect(existsSync(join(root, "dist/node_modules"))).toBe(false)
    expect(existsSync(join(root, "dist/readme.txt"))).toBe(false)
    const map = JSON.parse(readFileSync(join(root, "dist/lib/util.js.map"), "utf8"))
    expect(map.sources).toEqual(["../../src/lib/util.hn"])
  })

  it("컴파일 에러가 있으면 코드 조각을 출력하고 종료 코드 1, 나머지 파일은 계속 컴파일한다", () => {
    const root = project({ "a-bad.hn": "엄.. x = 1\n예???? x {\n}\n", "b-good.hn": "엄.. y = 2\n" })
    const r = node([HANNAMC, "."], root)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("a-bad.hn:2:1")
    expect(r.stderr).toContain("2 | 예???? x {")
    expect(r.stderr).not.toMatch(/^\s+at /m)
    expect(existsSync(join(root, "a-bad.js"))).toBe(false)
    expect(existsSync(join(root, "b-good.js"))).toBe(true)
  })

  it("확장자 없는 상대 import는 컴파일 에러다", () => {
    const root = project({ "main.hn": `import { 인사 } from "./util"\n` })
    const r = node([HANNAMC, "main.hn"], root)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("main.hn:1:")
  })

  it("없는 파일, .hn이 아닌 파일, 알 수 없는 옵션은 종료 코드 1", () => {
    const root = project({ "x.js": "" })
    expect(node([HANNAMC, "없음.hn"], root).status).toBe(1)
    expect(node([HANNAMC, "x.js"], root).status).toBe(1)
    expect(node([HANNAMC, "--wat"], root).status).toBe(1)
    expect(node([HANNAMC], root).status).toBe(1)
  })

  it("--version과 --help", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
    expect(node([HANNAMC, "--version"]).stdout.trim()).toBe(pkg.version)
    const help = node([HANNAMC, "--help"])
    expect(help.status).toBe(0)
    expect(help.stdout).toContain("--out-dir")
  })
})
