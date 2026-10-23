import { readFileSync } from "node:fs"
import { join } from "node:path"
import { decode } from "@jridgewell/sourcemap-codec"
import { parse } from "acorn"
import { describe, expect, it } from "vitest"
import { compile } from "../src/index.js"

const todo = join(import.meta.dirname, "../../../examples/todo")
const todoFiles = ["server/server.mz", "web/api.mz", "web/main.mz"]

describe("투두 예제", () => {
  it.each(todoFiles)("%s", async (file) => {
    const source = readFileSync(join(todo, file), "utf8")
    const { code } = compile(source, { filename: file, rewriteImports: true })
    expect(() => parse(code, { ecmaVersion: "latest", sourceType: "module" })).not.toThrow()
    await expect(code).toMatchFileSnapshot(join("__snapshots__/todo", file.replace(/\.mz$/, ".js")))
  })
})

describe("import", () => {
  it("rewriteImports면 상대 경로의 .mz를 .js로 바꾼다", () => {
    const source = [
      'import { a } from "./store.mz"',
      'import "../side.mz"',
      'export * from "./all.mz"',
      'const m = import("./lazy.mz")',
      'import http from "node:http"',
      'import data from "./data.json"',
    ].join("\n")
    expect(compile(source, { rewriteImports: true }).code).toBe(
      [
        'import { a } from "./store.js"',
        'import "../side.js"',
        'export * from "./all.js"',
        'const m = import("./lazy.js")',
        'import http from "node:http"',
        'import data from "./data.json"',
      ].join("\n"),
    )
  })

  it("기본값으로는 .mz 경로를 그대로 둔다 (Vite·로더 훅용)", () => {
    expect(compile('import { a } from "./store.mz"').code).toBe('import { a } from "./store.mz"')
  })

  it("런타임 import 경로를 바꿀 수 있다", () => {
    const { code } = compile('아... 줴줴이야... 에러', { runtimeImport: "@mzscript/core/runtime" })
    expect(code).toBe('throw __mz.toError(에러)\nimport { __mz } from "@mzscript/core/runtime"\n')
  })
})

describe("소스맵", () => {
  it("변환된 위치가 .mz 원본 위치를 가리킨다", () => {
    const source = '엄.. 이름 = "엠지"\n예? 이름 {\n  무슨 발언이세요? 이름\n}\n'
    const { code, map } = compile(source, { filename: "app.mz" })
    expect(map.sources).toEqual(["app.mz"])
    expect(map.file).toBe("app.js")
    expect(map.sourcesContent).toEqual([source])

    const lines = decode(map.mappings)
    // 출력 3번째 줄의 `console.log` 시작 → 원본 3번째 줄 `무슨 발언이세요?` 시작
    const outLine = code.split("\n")[2]!
    const col = outLine.indexOf("console.log")
    const seg = lines[2]!.find((s) => s[0] === col)
    expect(seg).toBeDefined()
    expect(seg![2]).toBe(2) // 0부터 센 원본 줄
    expect(seg![3]).toBe(source.split("\n")[2]!.indexOf("무슨"))

    // 출력 2번째 줄 `이름` 조건 → 원본 2번째 줄 `이름`
    const condCol = code.split("\n")[1]!.indexOf("이름")
    const condSeg = lines[1]!.find((s) => s[0] === condCol)
    expect(condSeg?.[2]).toBe(1)
    expect(condSeg?.[3]).toBe(source.split("\n")[1]!.indexOf("이름"))
  })

  it("셔뱅 줄은 그대로 둔다", () => {
    expect(compile("#!/usr/bin/env mz\n무슨 발언이세요? 1").code).toBe("#!/usr/bin/env mz\nconsole.log(1)")
  })
})
