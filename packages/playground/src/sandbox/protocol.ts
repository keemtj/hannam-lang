// iframe → 부모 창으로 보내는 메시지 형식

export const MESSAGE_SOURCE = "mzscript-playground"

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug"

export type SandboxEvent =
  | { kind: "console"; level: ConsoleLevel; text: string }
  | { kind: "error"; message: string; line?: number }
  /** 반복문 감시가 시간 제한을 넘긴 반복문을 멈췄다. 부모는 iframe을 없앤다 */
  | { kind: "timeout"; seconds: number }
  /** 확인 창(confirm 등)이 닫혔다는 신호. 부모의 시간 제한을 다시 센다 */
  | { kind: "resume" }
  /** 최상위 코드 실행이 끝남 (이후에도 타이머 콜백의 출력은 계속 올 수 있다) */
  | { kind: "done" }

export interface SandboxMessage {
  source: typeof MESSAGE_SOURCE
  runId: string
  event: SandboxEvent
}

export function isSandboxMessage(data: unknown, runId: string): data is SandboxMessage {
  if (typeof data !== "object" || data === null) return false
  const m = data as Partial<SandboxMessage>
  return m.source === MESSAGE_SOURCE && m.runId === runId && typeof m.event === "object" && m.event !== null
}
