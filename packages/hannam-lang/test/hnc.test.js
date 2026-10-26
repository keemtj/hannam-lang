import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { HANNAM, HNC, cleanup, node, project } from "./helpers.js"

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

describe("hnc", () => {
  it("원본 옆에 .js와 .js.map을 만들고 import 경로를 .js로 바꾼다", () => {
    const root = project({ "main.hn": MAIN, "util.hn": UTIL })
    const r = node([HNC, "main.hn", "util.hn", "--source-map"], root)
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
    expect(node([HNC, "main.hn"], root).status).toBe(0)
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
    const r = node([HNC, "src", "--out-dir", "dist", "--source-map"], root)
    expect(r.stderr).toBe("")
    expect(r.status).toBe(0)
    expect(existsSync(join(root, "dist/main.js"))).toBe(true)
    expect(existsSync(join(root, "dist/lib/util.js"))).toBe(true)
    expect(existsSync(join(root, "dist/node_modules"))).toBe(false)
    expect(existsSync(join(root, "dist/readme.txt"))).toBe(false)
    const map = JSON.parse(readFileSync(join(root, "dist/lib/util.js.map"), "utf8"))
    expect(map.sources).toEqual(["../../src/lib/util.hn"])
  })

  it("파일 인자 여러 개와 --out-dir을 함께 쓰면 공통 조상 기준으로 구조를 유지한다", () => {
    const root = project({
      "a/main.hn": MAIN.replace("./util.hn", "./lib/util.hn"),
      "a/lib/util.hn": UTIL,
      "b/main.hn": `엄.. b = 1\n`,
    })
    const r = node([HNC, "a/main.hn", "a/lib/util.hn", "b/main.hn", "-o", "out"], root)
    expect(r.stderr).toBe("")
    expect(r.status).toBe(0)
    expect(readFileSync(join(root, "out/a/main.js"), "utf8")).toContain(`from "./lib/util.js"`)
    expect(existsSync(join(root, "out/a/lib/util.js"))).toBe(true)
    expect(readFileSync(join(root, "out/b/main.js"), "utf8")).toBe("const b = 1\n")
  })

  it("--out-dir 뒤에 값이 없거나 옵션이 오면 종료 코드 1", () => {
    const root = project({ "main.hn": MAIN })
    expect(node([HNC, "main.hn", "-o", "--source-map"], root).status).toBe(1)
    expect(node([HNC, "main.hn", "--out-dir="], root).status).toBe(1)
    expect(existsSync(join(root, "--source-map"))).toBe(false)
  })

  it("쓰기에 실패한 파일은 에러 메시지만 출력하고 나머지는 계속 컴파일한다", () => {
    const root = project({ "a.hn": `엄.. a = 1\n`, "b/c.hn": `엄.. c = 1\n`, "out/b": "디렉터리 자리에 있는 파일" })
    const r = node([HNC, ".", "-o", "out"], root)
    expect(r.status).toBe(1)
    // 경로는 OS 형식으로 출력한다 (Windows에서는 b\c.hn)
    expect(r.stderr).toMatch(/^hnc: b[\\/]c\.hn: /m)
    expect(r.stderr).not.toMatch(/^\s+at /m)
    expect(existsSync(join(root, "out/a.js"))).toBe(true)
  })

  it("컴파일 에러가 있으면 코드 조각을 출력하고 종료 코드 1, 나머지 파일은 계속 컴파일한다", () => {
    const root = project({ "a-bad.hn": "엄.. x = 1\n예???? x {\n}\n", "b-good.hn": "엄.. y = 2\n" })
    const r = node([HNC, "."], root)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("a-bad.hn:2:1")
    expect(r.stderr).toContain("2 | 예???? x {")
    expect(r.stderr).not.toMatch(/^\s+at /m)
    expect(existsSync(join(root, "a-bad.js"))).toBe(false)
    expect(existsSync(join(root, "b-good.js"))).toBe(true)
  })

  it("확장자 없는 상대 import는 경고만 내고 그대로 컴파일한다", () => {
    const root = project({ "main.hn": `import { 인사 } from "./util"\n` })
    const r = node([HNC, "main.hn"], root)
    expect(r.status).toBe(0)
    expect(r.stderr).toMatch(/^hnc: 경고: 확장자가 없는 상대 경로 import입니다/m)
    expect(r.stderr).toContain("main.hn:1:")
    expect(readFileSync(join(root, "main.js"), "utf8")).toContain(`from "./util"`)
  })

  it("없는 파일, .hn이 아닌 파일, 알 수 없는 옵션은 종료 코드 1", () => {
    const root = project({ "x.js": "" })
    expect(node([HNC, "없음.hn"], root).status).toBe(1)
    expect(node([HNC, "x.js"], root).status).toBe(1)
    expect(node([HNC, "--wat"], root).status).toBe(1)
    expect(node([HNC], root).status).toBe(1)
  })

  it("--version과 --help", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
    expect(node([HNC, "--version"]).stdout.trim()).toBe(pkg.version)
    const help = node([HNC, "--help"])
    expect(help.status).toBe(0)
    expect(help.stdout).toContain("--out-dir")
  })
})

describe("hnc --from-js", () => {
  const MAIN_JS = `import { add } from "./store.js"\n\nconst name = "한남"\nif (name) {\n  add(name)\n}\nconsole.log("ok")\n`
  const STORE_JS = `export const items = []\nexport function add(x) {\n  items.push(x)\n}\n`

  it("기본은 바뀔 내용만 보여 주고 파일을 만들지 않는다", () => {
    const root = project({ "main.js": MAIN_JS, "store.js": STORE_JS })
    const r = node([HNC, "--from-js", "."], root)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain("main.js → main.hn (변환 4곳")
    expect(r.stdout).toContain(`  - if (name) {\n`)
    expect(r.stdout).toContain(`  + 예? name {\n`)
    expect(r.stdout).toContain("--write를 주면")
    expect(existsSync(join(root, "main.hn"))).toBe(false)
  })

  it("--write는 .hn을 만들고 .js는 남긴다. 함께 옮긴 파일의 import는 .hn으로 바꾼다", () => {
    const root = project({ "main.js": MAIN_JS, "store.js": STORE_JS })
    const r = node([HNC, "--from-js", "main.js", "store.js", "--write"], root)
    expect(r.status).toBe(0)
    expect(existsSync(join(root, "main.js"))).toBe(true)
    const main = readFileSync(join(root, "main.hn"), "utf8")
    expect(main).toContain(`import { add } from "./store.hn"`)
    expect(main).toContain(`무슨 발언이세요? "ok"`)
    expect(node([HANNAM, "main.hn"], root).stdout).toBe("ok\n")
  })

  it("함께 옮기지 않는 파일의 import는 .js 그대로 둔다", () => {
    const root = project({ "main.js": MAIN_JS, "store.js": STORE_JS })
    node([HNC, "--from-js", "main.js", "--write"], root)
    expect(readFileSync(join(root, "main.hn"), "utf8")).toContain(`from "./store.js"`)
  })

  it("--comments는 줄 맨 앞의 // 주석을 엄...으로 바꾼다", () => {
    const root = project({ "a.js": "// 설명\nconst a = 1\n" })
    node([HNC, "--from-js", "a.js", "--write", "--comments"], root)
    expect(readFileSync(join(root, "a.hn"), "utf8")).toBe("엄... 설명\n엄.. a = 1\n")
  })

  it("이미 있는 .hn은 덮어쓰지 않는다", () => {
    const root = project({ "a.js": "const a = 1\n", "a.hn": "원래 내용" })
    const r = node([HNC, "--from-js", "a.js", "--write"], root)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("이미 있어서 덮어쓰지 않았습니다")
    expect(readFileSync(join(root, "a.hn"), "utf8")).toBe("원래 내용")
  })

  it("CommonJS 파일은 건너뛰고 종료 코드 1, 나머지는 옮긴다", () => {
    const root = project({ "old.js": "module.exports = 1\n", "new.js": "const a = 1\n" })
    const r = node([HNC, "--from-js", ".", "--write"], root)
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/CommonJS\(module\).*old\.js:1:1/)
    expect(existsSync(join(root, "new.hn"))).toBe(true)
    expect(existsSync(join(root, "old.hn"))).toBe(false)
  })

  it("node_modules와 *.min.js는 대상에서 뺀다", () => {
    const root = project({ "a.js": "const a = 1\n", "node_modules/x/i.js": "const b = 1\n", "lib.min.js": "const c = 1\n" })
    const r = node([HNC, "--from-js", "."], root)
    expect(r.stdout).toContain("파일 1개")
  })

  it("옵션을 잘못 섞으면 종료 코드 1", () => {
    const root = project({ "a.js": "" })
    expect(node([HNC, "--write", "a.js"], root).status).toBe(1)
    expect(node([HNC, "--from-js", "a.js", "--out-dir", "out"], root).status).toBe(1)
    expect(node([HNC, "--from-js"], root).status).toBe(1)
    expect(node([HNC, "--from-js", "a.txt"], root).status).toBe(1)
  })
})

describe("hnc --from-js: 옮기지 못한 파일", () => {
  it("옮기지 못한 파일(CommonJS, 압축, 이미 있는 .hn)을 가리키는 import는 .js 그대로 둔다", () => {
    const root = project({
      "main.js": 'import { a } from "./cjs.js"\nimport { b } from "./big.js"\nimport { c } from "./exists.js"\nimport { d } from "./ok.js"\n',
      "cjs.js": "module.exports = 1\n",
      "big.js": `export const b = "${"x".repeat(1200)}"\n`,
      "exists.js": "export const c = 1\n",
      "exists.hn": "엄.. c = 0\n",
      "ok.js": "export const d = 1\n",
    })
    const r = node([HNC, "--from-js", ".", "--write"], root)
    expect(r.status).toBe(1)
    const main = readFileSync(join(root, "main.hn"), "utf8")
    expect(main).toContain(`from "./cjs.js"`)
    expect(main).toContain(`from "./big.js"`)
    expect(main).toContain(`from "./exists.js"`)
    expect(main).toContain(`from "./ok.hn"`)
    expect(r.stdout).toContain("파일 2개")
  })

  it("같은 .hn으로 바뀌는 a.js와 a.mjs는 둘 다 옮기지 않는다", () => {
    const root = project({ "a.js": "const a = 1\n", "a.mjs": "const a = 2\n" })
    const r = node([HNC, "--from-js", ".", "--write"], root)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("같은 .hn으로 바뀌는 파일이 여럿입니다")
    expect(existsSync(join(root, "a.hn"))).toBe(false)
  })

  it("직접 지정한 *.min.js도 옮기지 않는다", () => {
    const root = project({ "lib.min.js": "const a = 1\n" })
    const r = node([HNC, "--from-js", "lib.min.js", "--write"], root)
    expect(r.stdout).toContain("압축된 파일")
    expect(existsSync(join(root, "lib.min.hn"))).toBe(false)
  })

  it("출력을 파이프로 넘겨도 끝까지 나온다", () => {
    const files = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`f${i}.js`, Array.from({ length: 400 }, (_, j) => `const v${j} = ${j}`).join("\n")]),
    )
    const root = project(files)
    // spawnSync의 stdout은 파이프다
    const r = node([HNC, "--from-js", "."], root)
    expect(r.stdout.length).toBeGreaterThan(65536)
    expect(r.stdout).toContain("파일 20개")
  })
})
