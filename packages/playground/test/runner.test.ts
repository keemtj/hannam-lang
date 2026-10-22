// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { MESSAGE_SOURCE, type SandboxEvent } from "../src/sandbox/protocol"
import { startRun } from "../src/sandbox/runner"

// jsdom은 srcdoc 안의 스크립트를 실행하지 않으므로, iframe 메시지는 직접 흉내 낸다
describe("startRun: iframe 관리와 시간 제한", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ""
  })
  afterEach(() => vi.useRealTimers())

  function setup() {
    const events: SandboxEvent[] = []
    const timeouts: number[] = []
    const handle = startRun({
      host: document.body,
      code: 'console.log("안녕")',
      loopLimitMs: 1000,
      idleTimeoutMs: 3000,
      onEvent: (e) => events.push(e),
      onTimeout: (s) => timeouts.push(s),
    })
    const iframe = document.querySelector("iframe")!
    const runId = /"runId":"([^"]+)"/.exec(iframe.srcdoc)![1]!
    const post = (event: SandboxEvent, overrides: Record<string, unknown> = {}) =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { source: MESSAGE_SOURCE, runId, event, ...overrides },
          source: iframe.contentWindow,
        }),
      )
    return { events, timeouts, handle, iframe, post }
  }

  test("샌드박스 속성을 단 iframe을 만든다", () => {
    const { iframe } = setup()
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts allow-modals")
    expect(iframe.srcdoc).toContain('<script type="importmap">')
  })

  test("신호 없이 시간이 지나면 iframe을 없애고 onTimeout을 부른다", () => {
    const { timeouts } = setup()
    vi.advanceTimersByTime(2999)
    expect(timeouts).toEqual([])
    vi.advanceTimersByTime(1)
    expect(timeouts).toEqual([3])
    expect(document.querySelector("iframe")).toBeNull()
  })

  test("메시지가 올 때마다 시간을 다시 세고, done 뒤에는 끊지 않는다", () => {
    const { events, timeouts, post } = setup()
    vi.advanceTimersByTime(2500)
    post({ kind: "console", level: "log", text: "안녕" })
    vi.advanceTimersByTime(2500)
    post({ kind: "resume" })
    vi.advanceTimersByTime(2500)
    post({ kind: "done" })
    vi.advanceTimersByTime(60_000)
    expect(timeouts).toEqual([])
    expect(events.map((e) => e.kind)).toEqual(["console", "resume", "done"])
    expect(document.querySelector("iframe")).not.toBeNull()
  })

  test("반복문 감시의 timeout 신호를 받으면 iframe을 없앤다", () => {
    const { events, timeouts, post } = setup()
    post({ kind: "timeout", seconds: 1 })
    expect(timeouts).toEqual([1])
    expect(events).toEqual([])
    expect(document.querySelector("iframe")).toBeNull()
  })

  test("다른 실행·다른 출처의 메시지는 무시하고, stop하면 정리한다", () => {
    const { events, handle, post } = setup()
    post({ kind: "console", level: "log", text: "남의 것" }, { runId: "other" })
    window.dispatchEvent(new MessageEvent("message", { data: { source: MESSAGE_SOURCE, event: { kind: "done" } } }))
    expect(events).toEqual([])
    handle.stop()
    expect(document.querySelector("iframe")).toBeNull()
    post({ kind: "console", level: "log", text: "늦음" })
    expect(events).toEqual([])
  })
})
