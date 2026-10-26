import { describe, expect, test } from "vitest"
import { importJs, importNotice } from "../src/importJs"

describe("JS 가져오기", () => {
  test("JS를 한남랭으로 바꾸고 주석도 엄...으로 바꾼다", async () => {
    const outcome = await importJs('// 인사\nconst name = "철수"\nif (name) {\n  console.log(name)\n}')
    expect(outcome).toEqual({
      ok: true,
      code: '엄... 인사\n엄.. name = "철수"\n예? name {\n  무슨 발언이세요? name\n}',
      changes: 4,
      skipped: 0,
    })
  })

  test("바꾸지 못한 곳이 있으면 안내에 함께 적는다", async () => {
    const mixed = await importJs('const a = 1\nthrow "x"')
    expect(mixed.ok && importNotice(mixed)).toBe("JS 1곳을 한남랭으로 바꿨습니다. 1곳은 바꾸지 않고 JS 그대로 두었습니다.")
    const none = await importJs('throw "x"')
    expect(none.ok && importNotice(none)).toBe("한남랭 키워드로 바꿀 수 있는 곳이 없어서 JS 그대로 넣었습니다.")
  })

  test("읽을 수 없는 JS와 CommonJS는 이유를 돌려준다", async () => {
    expect(await importJs("const a = <div />")).toMatchObject({ ok: false, message: expect.stringContaining("JS로 읽을 수 없습니다") })
    expect(await importJs('const fs = require("fs")')).toMatchObject({ ok: false, message: expect.stringContaining("CommonJS") })
  })
})
