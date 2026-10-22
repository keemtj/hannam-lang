import { describe, expect, test } from "vitest"
import { decodeHash, encodeHash } from "../src/share"
import { EXAMPLES } from "../src/examples"

describe("URL 해시 공유", () => {
  test("인코딩한 해시를 디코딩하면 원래 코드가 나온다", () => {
    const codes = ["", "무슨 발언이세요? \"안녕\"", "엄.. 이모지 = \"🙂 ✔ □\"\n\t탭과 \\ 역슬래시 # % & ?", ...EXAMPLES.map((e) => e.code)]
    for (const code of codes) {
      const hash = encodeHash(code)
      expect(hash.startsWith("#code/")).toBe(true)
      // URL에 그대로 넣어도 되는 글자만 쓴다
      expect(hash.slice(6)).toMatch(/^[A-Za-z0-9+\-$]*$/)
      expect(decodeHash(hash)).toBe(code)
    }
  })

  test("압축되어 원문보다 짧아진다", () => {
    const code = EXAMPLES.find((e) => e.id === "loops")!.code
    expect(encodeHash(code).length).toBeLessThan(encodeURIComponent(code).length)
  })

  test("형식이 다르거나 깨진 해시는 null", () => {
    expect(decodeHash("")).toBeNull()
    expect(decodeHash("#other")).toBeNull()
    expect(decodeHash("#code/@@@@")).toBeNull()
  })
})
