// iframe 안에서 사용자 코드보다 먼저 실행하는 준비 코드.
// srcdoc에 `(${iframeBootstrap.toString()})(window, 설정)` 형태로 그대로 넣으므로
// 이 함수는 바깥 스코프의 변수·import를 쓰면 안 된다 (자기 완결).

export interface BootstrapConfig {
  source: string
  runId: string
  /** 한 번의 동기 실행(매크로태스크)에서 반복문이 쓸 수 있는 최대 시간(ms) */
  loopLimitMs: number
}

/** iframeBootstrap이 실제로 건드리는 window 속성만 추린 타입 (테스트에서 가짜 window를 넣기 위함) */
export interface BootstrapWindow {
  parent: { postMessage(message: unknown, targetOrigin: string): void }
  console: Record<string, (...args: unknown[]) => void>
  addEventListener(type: string, listener: (event: any) => void): void
  setTimeout(handler: () => void, ms?: number): unknown
  performance: { now(): number }
  confirm?: (message?: string) => boolean
  alert?: (message?: string) => void
  prompt?: (message?: string, defaultValue?: string) => string | null
  [key: string]: unknown
}

export function iframeBootstrap(win: BootstrapWindow, config: BootstrapConfig): void {
  const { source, runId, loopLimitMs } = config

  function send(event: Record<string, unknown>) {
    try {
      win.parent.postMessage({ source, runId, event }, "*")
    } catch {
      // 부모가 사라졌으면 보낼 곳이 없다
    }
  }

  // ── 값 출력 (브라우저 개발자 도구와 비슷한 짧은 표현) ──
  function format(value: unknown, depth: number, seen: unknown[]): string {
    if (typeof value === "string") return depth === 0 ? value : JSON.stringify(value)
    if (value === null) return "null"
    if (value === undefined) return "undefined"
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    if (typeof value === "bigint") return `${value}n`
    if (typeof value === "symbol") return value.toString()
    if (typeof value === "function") return `ƒ ${value.name || "(익명)"}()`
    if (value instanceof Error) return `${value.name}: ${value.message}`
    if (seen.includes(value)) return "[순환 참조]"
    if (depth > 3) return Array.isArray(value) ? "[…]" : "{…}"
    const next = seen.concat([value])
    if (Array.isArray(value)) return `[${value.map((v) => format(v, depth + 1, next)).join(", ")}]`
    if (value instanceof Map) {
      const items = [...value].map(([k, v]) => `${format(k, depth + 1, next)} => ${format(v, depth + 1, next)}`)
      return `Map(${value.size}) {${items.join(", ")}}`
    }
    if (value instanceof Set) return `Set(${value.size}) {${[...value].map((v) => format(v, depth + 1, next)).join(", ")}}`
    if (value instanceof Date) return value.toISOString()
    if (value instanceof RegExp) return String(value)
    if (value instanceof Promise) return "Promise {…}"
    const ctor = (value as object).constructor
    const prefix = ctor && ctor !== Object && typeof ctor.name === "string" && ctor.name ? `${ctor.name} ` : ""
    const entries = Object.keys(value as object).map((k) => {
      const key = /^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*$/u.test(k) ? k : JSON.stringify(k)
      return `${key}: ${format((value as Record<string, unknown>)[k], depth + 1, next)}`
    })
    return entries.length === 0 ? `${prefix}{}` : `${prefix}{ ${entries.join(", ")} }`
  }

  function formatArgs(args: unknown[]): string {
    return args.map((a) => format(a, 0, [])).join(" ")
  }

  // ── console 가로채기 ──
  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = win.console[level]
    win.console[level] = (...args: unknown[]) => {
      send({ kind: "console", level, text: formatArgs(args) })
      if (original) original.apply(win.console, args)
    }
  }

  // ── 에러 보고 ──
  // blob 모듈의 스택에서 줄 번호를 찾는다. 변환된 JS는 .hn 원본과 줄 번호가 같다
  function lineOf(error: unknown): number | undefined {
    const stack = error instanceof Error ? error.stack ?? "" : ""
    const m = /blob:[^\s)]*?:(\d+):\d+/.exec(stack)
    return m ? Number(m[1]) : undefined
  }

  function reportError(error: unknown) {
    // 반복문 감시가 던진 에러는 이미 timeout으로 알렸다
    if (error instanceof Error && (error as { __hnLoop?: boolean }).__hnLoop) return
    const message = error instanceof Error ? `${error.name}: ${error.message}` : `잡히지 않은 값: ${format(error, 1, [])}`
    send({ kind: "error", message, line: lineOf(error) })
  }

  win.addEventListener("error", (e: { error?: unknown; message?: string }) => {
    reportError(e.error ?? new Error(e.message ?? "알 수 없는 에러"))
  })
  win.addEventListener("unhandledrejection", (e: { reason?: unknown }) => {
    reportError(e.reason)
  })

  // ── 무한 루프 감시 ──
  // 반복문 몸체마다 `__hn_loop()`가 들어간다 (instrumentLoops 참고).
  // 같은 매크로태스크 안에서 loopLimitMs를 넘기면 에러를 던져 멈춘다.
  // 확인 창이 떠 있던 시간은 빼고 센다.
  let taskStart = 0
  let pausedMs = 0
  let inTask = false
  let tripped = false
  let counter = 0

  function now() {
    return win.performance.now()
  }

  function loopError() {
    const error = new Error(`반복문이 ${loopLimitMs / 1000}초 넘게 끝나지 않아 멈췄습니다`)
    ;(error as { __hnLoop?: boolean }).__hnLoop = true
    return error
  }

  win.__hn_loop = () => {
    if (tripped) throw loopError()
    if (!inTask) {
      inTask = true
      taskStart = now()
      pausedMs = 0
      counter = 0
      win.setTimeout(() => {
        inTask = false
      }, 0)
    }
    if (++counter % 1000 !== 0) return
    if (now() - taskStart - pausedMs > loopLimitMs) {
      tripped = true
      // 사용자 코드가 try/catch로 삼켜도 멈추도록 부모에게 먼저 알린다 (부모가 iframe을 없앤다)
      send({ kind: "timeout", seconds: loopLimitMs / 1000 })
      win.setTimeout(() => {
        tripped = false
      }, 0)
      throw loopError()
    }
  }

  // ── 확인 창 (모달이 떠 있는 동안은 시간 제한에서 뺀다) ──
  for (const name of ["confirm", "alert", "prompt"] as const) {
    const original = win[name] as ((...args: unknown[]) => unknown) | undefined
    if (typeof original !== "function") continue
    ;(win as Record<string, unknown>)[name] = (...args: unknown[]) => {
      const start = now()
      try {
        return original.apply(win, args)
      } finally {
        pausedMs += now() - start
        send({ kind: "resume" })
      }
    }
  }

  win.__hn_report = reportError
  win.__hn_done = () => send({ kind: "done" })
}
