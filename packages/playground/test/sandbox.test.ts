import { describe, expect, test } from "vitest"
import { iframeBootstrap, type BootstrapWindow } from "../src/sandbox/bootstrap"
import { initialRunState, MAX_LOGS, runReducer, type RunState } from "../src/sandbox/consoleLog"
import { instrumentLoops } from "../src/sandbox/instrument"
import { MESSAGE_SOURCE, isSandboxMessage, type SandboxEvent } from "../src/sandbox/protocol"
import { buildSrcdoc, scriptJson } from "../src/sandbox/srcdoc"

/** iframeBootstrap에 넣을 가짜 window. 보낸 메시지·시계·타이머를 직접 조종한다 */
function fakeWindow() {
  const sent: SandboxEvent[] = []
  const listeners: Record<string, ((e: unknown) => void)[]> = {}
  const timers: (() => void)[] = []
  const nativeLogs: unknown[][] = []
  const clock = { now: 0 }
  const win: BootstrapWindow = {
    parent: {
      postMessage(message: unknown) {
        expect(isSandboxMessage(message, "run-1")).toBe(true)
        sent.push((message as { event: SandboxEvent }).event)
      },
    },
    console: { log: (...args: unknown[]) => nativeLogs.push(args) },
    addEventListener(type, listener) {
      ;(listeners[type] ??= []).push(listener)
    },
    setTimeout(handler) {
      timers.push(handler)
    },
    performance: { now: () => clock.now },
    confirm: () => {
      clock.now += 10_000 // 사용자가 10초 동안 고민했다
      return true
    },
  }
  iframeBootstrap(win, { source: MESSAGE_SOURCE, runId: "run-1", loopLimitMs: 1000 })
  const flushTimers = () => timers.splice(0).forEach((t) => t())
  return { win, sent, listeners, clock, flushTimers, nativeLogs }
}

const call = (win: BootstrapWindow, name: string, ...args: unknown[]) => (win[name] as (...a: unknown[]) => unknown)(...args)

describe("iframeBootstrap: 출력 수집", () => {
  test("console 출력을 부모에게 보내고 원래 console도 부른다", () => {
    const { win, sent, nativeLogs } = fakeWindow()
    win.console.log!("할 일", 3, true, null, undefined)
    win.console.warn!("경고")
    expect(sent).toEqual([
      { kind: "console", level: "log", text: "할 일 3 true null undefined" },
      { kind: "console", level: "warn", text: "경고" },
    ])
    expect(nativeLogs).toEqual([["할 일", 3, true, null, undefined]])
  })

  test("객체·배열·Map·Set·에러·함수·순환 참조를 읽기 좋게 만든다", () => {
    const { win, sent } = fakeWindow()
    class 할일 {
      내용 = "숙제"
      완료 = false
    }
    const cyclic: Record<string, unknown> = { 이름: "a" }
    cyclic.self = cyclic
    win.console.log!([1, "a", { b: [2] }])
    win.console.log!(new 할일())
    win.console.log!(new Map([["k", 1]]), new Set([1, 2]))
    win.console.log!(new TypeError("잘못됨"), function 더하기() {}, 10n)
    win.console.log!(cyclic, { "띄어 쓴 키": 1 })
    expect(sent.map((e) => (e.kind === "console" ? e.text : e.kind))).toEqual([
      '[1, "a", { b: [2] }]',
      '할일 { 내용: "숙제", 완료: false }',
      'Map(1) {"k" => 1} Set(2) {1, 2}',
      "TypeError: 잘못됨 ƒ 더하기() 10n",
      '{ 이름: "a", self: [순환 참조] } { "띄어 쓴 키": 1 }',
    ])
  })

  test("에러와 처리되지 않은 Promise 거부를 줄 번호와 함께 보고한다", () => {
    const { win, sent, listeners } = fakeWindow()
    const error = new TypeError("x is null")
    error.stack = "TypeError: x is null\n    at blob:null/1234-abcd:7:3"
    listeners.error![0]!({ error })
    listeners.unhandledrejection![0]!({ reason: "문자열 거부" })
    call(win, "__mz_report", new Error("직접 보고"))
    call(win, "__mz_done")
    expect(sent).toEqual([
      { kind: "error", message: "TypeError: x is null", line: 7 },
      { kind: "error", message: '잡히지 않은 값: "문자열 거부"', line: undefined },
      { kind: "error", message: "Error: 직접 보고", line: undefined },
      { kind: "done" },
    ])
  })
})

describe("iframeBootstrap: 무한 루프 감시", () => {
  test("한 매크로태스크에서 제한 시간을 넘기면 timeout을 알리고 에러를 던진다", () => {
    const { win, sent, clock } = fakeWindow()
    const loop = () => call(win, "__mz_loop")
    expect(() => {
      for (let i = 0; i < 100_000; i++) {
        clock.now += 0.1
        loop()
      }
    }).toThrow("반복문이 1초 넘게 끝나지 않아 멈췄습니다")
    expect(sent).toEqual([{ kind: "timeout", seconds: 1 }])
    // 사용자 코드가 에러를 삼켜도 같은 태스크 안의 다음 반복문은 바로 멈춘다
    expect(loop).toThrow()
    // 감시가 던진 에러는 error로 다시 보고하지 않는다
    try {
      loop()
    } catch (e) {
      call(win, "__mz_report", e)
    }
    expect(sent).toHaveLength(1)
  })

  test("다음 매크로태스크에서는 시간을 새로 센다", () => {
    const { win, clock, flushTimers } = fakeWindow()
    const loop = () => call(win, "__mz_loop")
    expect(() => {
      for (let task = 0; task < 5; task++) {
        for (let i = 0; i < 5000; i++) {
          clock.now += 0.1 // 태스크마다 0.5초, 합치면 2.5초
          loop()
        }
        flushTimers()
      }
    }).not.toThrow()
  })

  test("confirm 창이 떠 있던 시간은 빼고 세고, 닫히면 resume을 보낸다", () => {
    const { win, sent, clock } = fakeWindow()
    const loop = () => call(win, "__mz_loop")
    for (let i = 0; i < 3000; i++) {
      clock.now += 0.1
      loop()
      if (i === 1500) expect(call(win, "confirm", "계속?")).toBe(true)
    }
    expect(sent).toEqual([{ kind: "resume" }])
  })
})

describe("instrumentLoops", () => {
  test("모든 반복문 몸체 앞에 감시 호출을 넣고 줄 번호는 그대로 둔다", () => {
    const code = [
      "for (let i = 0; i < 3; i++) {",
      "  while (x) x--",
      "}",
      "for (const a of b) for (const k in a) {}",
      "do { y++ } while (y < 3)",
      "const s = 'while (true) {}'",
    ].join("\n")
    const out = instrumentLoops(code)
    expect(out).toBe(
      [
        "for (let i = 0; i < 3; i++) {__mz_loop();",
        "  while (x) {__mz_loop();x--}",
        "}",
        "for (const a of b) {__mz_loop();for (const k in a) {__mz_loop();}}",
        "do {__mz_loop(); y++ } while (y < 3)",
        "const s = 'while (true) {}'",
      ].join("\n"),
    )
  })

  test("최상위 await와 import가 있는 모듈도 처리하고, 문법 에러면 원본을 돌려준다", () => {
    const code = 'const a = await f()\nwhile (a) {}\nimport { __mz } from "mzscript/runtime"\n'
    expect(instrumentLoops(code)).toContain("while (a) {__mz_loop();}")
    expect(instrumentLoops("while (")).toBe("while (")
  })
})

describe("buildSrcdoc", () => {
  test("import map으로 런타임을 공급하고, 사용자 코드가 script 태그를 끊지 못한다", () => {
    const html = buildSrcdoc('console.log("</script><script>alert(1)</script>")\nwhile (true) {}', {
      runId: "run-9",
      loopLimitMs: 3000,
    })
    expect(html).toContain('<script type="importmap">{"imports":{"mzscript/runtime":"data:text/javascript;charset=utf-8,')
    expect(html.match(/<\/script>/g)).toHaveLength(3)
    expect(html).toContain("while (true) {__mz_loop();}")
    expect(html).toContain('"runId":"run-9"')
    expect(html).toContain('"loopLimitMs":3000')
  })

  test("scriptJson은 <와 줄 구분 문자를 이스케이프한다", () => {
    const json = scriptJson("<!-- \u2028 \u2029")
    expect(json).not.toMatch(/[<\u2028\u2029]/)
    expect(JSON.parse(json)).toBe("<!-- \u2028 \u2029")
  })
})

describe("runReducer: 실행 결과 모으기", () => {
  const event = (e: SandboxEvent) => ({ type: "event" as const, event: e })

  test("실행을 시작하면 콘솔을 비우고, 출력·에러를 쌓다가 done에서 끝난다", () => {
    let state: RunState = { status: "done", logs: [{ id: 0, level: "log", text: "이전 실행" }] }
    state = runReducer(state, { type: "start" })
    expect(state).toEqual({ status: "running", logs: [] })
    state = runReducer(state, event({ kind: "console", level: "log", text: "안녕" }))
    state = runReducer(state, event({ kind: "error", message: "TypeError: x", line: 3 }))
    state = runReducer(state, event({ kind: "resume" }))
    state = runReducer(state, event({ kind: "done" }))
    expect(state.status).toBe("done")
    expect(state.logs.map((l) => [l.level, l.text])).toEqual([
      ["log", "안녕"],
      ["error", "TypeError: x (3번째 줄)"],
    ])
    // done 뒤에도 타이머 콜백의 출력은 계속 받는다
    state = runReducer(state, event({ kind: "console", level: "info", text: "나중에" }))
    expect(state.logs).toHaveLength(3)
  })

  test("시간 제한으로 멈추면 안내를 남기고 늦게 온 메시지는 버린다", () => {
    let state = runReducer(initialRunState, { type: "start" })
    state = runReducer(state, event({ kind: "timeout", seconds: 3 }))
    expect(state.status).toBe("timeout")
    expect(state.logs.at(-1)?.text).toBe("3초 넘게 끝나지 않아 실행을 멈췄습니다 (무한 루프인지 확인하세요)")
    const after = runReducer(state, event({ kind: "console", level: "log", text: "늦음" }))
    expect(after).toBe(state)
  })

  test("정지·지우기, 그리고 로그 개수 제한", () => {
    let state = runReducer(initialRunState, { type: "start" })
    for (let i = 0; i < MAX_LOGS + 20; i++) {
      state = runReducer(state, event({ kind: "console", level: "log", text: String(i) }))
    }
    expect(state.logs).toHaveLength(MAX_LOGS)
    expect(state.logs[0]!.text).toBe("20")
    state = runReducer(state, { type: "stop" })
    expect(state.status).toBe("stopped")
    expect(state.logs.at(-1)!.text).toBe("실행을 멈췄습니다")
    expect(runReducer(state, { type: "clear" }).logs).toEqual([])
  })
})
