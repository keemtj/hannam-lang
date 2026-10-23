import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "acorn"
import { describe, expect, it } from "vitest"
import { compile } from "../src/index.js"

// 명세 = 테스트: fixtures/*.mz를 변환한 결과가 같은 이름의 .js와 정확히 같아야 한다
const dir = join(import.meta.dirname, "fixtures")
const names = readdirSync(dir)
  .filter((f) => f.endsWith(".mz"))
  .map((f) => f.slice(0, -3))

describe("명세 예제", () => {
  it.each(names)("%s", (name) => {
    const source = readFileSync(join(dir, `${name}.mz`), "utf8")
    const expected = readFileSync(join(dir, `${name}.js`), "utf8")
    const { code } = compile(source, { filename: `${name}.mz` })
    expect(code).toBe(expected)
    // 결과는 유효한 JS 모듈이어야 한다
    expect(() => parse(code, { ecmaVersion: "latest", sourceType: "module" })).not.toThrow()
  })

  it("런타임을 쓰지 않으면 줄 수가 원본과 같다", () => {
    for (const name of names) {
      const source = readFileSync(join(dir, `${name}.mz`), "utf8")
      const { code } = compile(source)
      if (code.includes("__mz.")) continue
      expect(code.split("\n").length, name).toBe(source.split("\n").length)
    }
  })
})
