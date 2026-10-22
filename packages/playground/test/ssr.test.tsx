import { renderToString } from "react-dom/server"
import { describe, expect, test } from "vitest"

describe("SSR 안전성", () => {
  test("window 없이 모듈을 불러오고 서버 렌더링할 수 있다", async () => {
    expect(typeof window).toBe("undefined")
    const { Playground } = await import("../src")
    const html = renderToString(<Playground initialCode={'무슨 발언이세요? "서버"'} height={400} />)
    expect(html).toContain('class="hnpg"')
    expect(html).toContain("height:400px")
    expect(html).toContain("▶ 실행")
    expect(html).toContain(".hnpg {")
  })

  test("변환 에러가 있는 코드도 서버에서 에러 배너와 함께 그린다", async () => {
    const { Playground } = await import("../src")
    const html = renderToString(<Playground initialCode="예???? 1 {}" />)
    expect(html).toContain("물음표는 1~3개만")
    expect(html).toContain("disabled")
  })
})
