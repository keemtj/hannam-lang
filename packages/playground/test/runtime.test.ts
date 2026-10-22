import { __hn as coreRuntime } from "@hannam-lang/core/runtime"
import { afterEach, describe, expect, test } from "vitest"
import { RUNTIME_SOURCE, runtimeDataUrl } from "../src/sandbox/runtime"

describe("iframe용 런타임", () => {
  const g = globalThis as { confirm?: (q: string) => boolean }
  afterEach(() => {
    delete g.confirm
  })

  test("data: URL로 불러올 수 있고, core 런타임과 같은 동작을 한다", async () => {
    const { __hn } = (await import(/* @vite-ignore */ runtimeDataUrl())) as { __hn: typeof coreRuntime }
    expect(Object.keys(__hn).sort()).toEqual(Object.keys(coreRuntime).sort())

    const fromString = __hn.toError("문자열") as Error
    expect(fromString).toBeInstanceOf(Error)
    expect(fromString.message).toBe((coreRuntime.toError("문자열") as Error).message)
    const original = new TypeError("그대로")
    expect(__hn.toError(original)).toBe(original)
    expect(__hn.toError(42)).toBe(coreRuntime.toError(42))

    const asked: string[] = []
    g.confirm = (q) => {
      asked.push(q)
      return q.includes("예")
    }
    expect(__hn.confirm("예라고 할까요?")).toBe(coreRuntime.confirm("예라고 할까요?"))
    expect(__hn.confirm(123)).toBe(coreRuntime.confirm(123))
    expect(asked).toEqual(["예라고 할까요?", "예라고 할까요?", "123", "123"])
  })

  test("런타임 소스는 ESM export 하나만 담는다", () => {
    expect(RUNTIME_SOURCE).toMatch(/^export const __hn = \{/)
  })
})
