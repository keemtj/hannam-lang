import type { ConsoleLevel, SandboxEvent } from "./protocol"

export type RunStatus = "idle" | "running" | "done" | "stopped" | "timeout"

export interface LogEntry {
  id: number
  level: ConsoleLevel | "system"
  text: string
}

export interface RunState {
  status: RunStatus
  logs: LogEntry[]
}

export const initialRunState: RunState = { status: "idle", logs: [] }

/** 너무 많이 찍어도 화면이 멈추지 않게 남길 줄 수를 제한한다 */
export const MAX_LOGS = 500

export type RunAction =
  | { type: "start" }
  | { type: "event"; event: SandboxEvent }
  | { type: "timeout"; seconds: number }
  | { type: "stop" }
  | { type: "clear" }

let nextId = 1

function push(state: RunState, level: LogEntry["level"], text: string): LogEntry[] {
  const logs = state.logs.concat({ id: nextId++, level, text })
  return logs.length > MAX_LOGS ? logs.slice(logs.length - MAX_LOGS) : logs
}

/** 실행 결과(콘솔 출력·에러·상태)를 모으는 리듀서 */
export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "start":
      return { status: "running", logs: [] }
    case "clear":
      return { ...state, logs: [] }
    case "stop":
      return state.status === "running" ? { status: "stopped", logs: push(state, "system", "실행을 멈췄습니다") } : state
    case "timeout":
      return {
        status: "timeout",
        logs: push(state, "error", `${action.seconds}초 넘게 끝나지 않아 실행을 멈췄습니다 (무한 루프인지 확인하세요)`),
      }
    case "event":
      return applyEvent(state, action.event)
  }
}

function applyEvent(state: RunState, event: SandboxEvent): RunState {
  // 시간 제한이나 정지로 끊긴 뒤 늦게 도착한 메시지는 버린다
  if (state.status === "timeout" || state.status === "stopped") return state
  switch (event.kind) {
    case "console":
      return { ...state, logs: push(state, event.level, event.text) }
    case "error": {
      const where = event.line ? ` (${event.line}번째 줄)` : ""
      return { ...state, logs: push(state, "error", `${event.message}${where}`) }
    }
    case "done":
      return state.status === "running" ? { ...state, status: "done" } : state
    case "timeout":
      return runReducer(state, { type: "timeout", seconds: event.seconds })
    case "resume":
      return state
  }
}
