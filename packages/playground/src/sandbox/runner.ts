import { isSandboxMessage, type SandboxEvent } from "./protocol"
import { buildSrcdoc } from "./srcdoc"

export interface RunOptions {
  /** iframe을 붙일 요소 */
  host: HTMLElement
  /** 변환된 JS */
  code: string
  /** iframe 안에서 반복문 하나가 동기로 돌 수 있는 시간 */
  loopLimitMs: number
  /** 최상위 실행이 끝나기 전, iframe에서 아무 신호가 없을 때 끊는 시간 (반복문 감시가 못 잡는 경우 대비) */
  idleTimeoutMs: number
  onEvent(event: SandboxEvent): void
  /** 시간 제한으로 iframe을 없앴을 때. seconds는 넘긴 제한 시간(초) */
  onTimeout(seconds: number): void
}

export interface RunHandle {
  stop(): void
}

let runCount = 0

/**
 * 샌드박스 iframe에서 코드를 실행한다.
 * `allow-same-origin`이 없어서 iframe은 부모 페이지의 쿠키·저장소·DOM에 접근할 수 없다.
 * `allow-modals`는 `예? 무슨 발언이세요?`(confirm) 창을 띄우기 위해 필요하다.
 */
export function startRun(options: RunOptions): RunHandle {
  const { host, code, loopLimitMs, idleTimeoutMs, onEvent, onTimeout } = options
  const runId = `${Date.now().toString(36)}-${++runCount}`
  const win = host.ownerDocument.defaultView!

  const iframe = host.ownerDocument.createElement("iframe")
  iframe.setAttribute("sandbox", "allow-scripts allow-modals")
  iframe.setAttribute("title", "hannam-lang 실행 샌드박스")
  iframe.setAttribute("aria-hidden", "true")
  iframe.tabIndex = -1
  iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden"

  let finished = false
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const armTimer = () => {
    if (timer !== undefined) clearTimeout(timer)
    if (finished || disposed) return
    timer = setTimeout(() => {
      dispose()
      onTimeout(idleTimeoutMs / 1000)
    }, idleTimeoutMs)
  }

  const onMessage = (e: MessageEvent) => {
    if (disposed || e.source !== iframe.contentWindow || !isSandboxMessage(e.data, runId)) return
    const event = e.data.event
    if (event.kind === "timeout") {
      dispose()
      onTimeout(event.seconds)
      return
    }
    if (event.kind === "done") {
      finished = true
      if (timer !== undefined) clearTimeout(timer)
    } else {
      armTimer()
    }
    onEvent(event)
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    if (timer !== undefined) clearTimeout(timer)
    win.removeEventListener("message", onMessage)
    // iframe을 없애면 안에서 돌던 코드도 함께 끊긴다
    iframe.remove()
  }

  win.addEventListener("message", onMessage)
  iframe.srcdoc = buildSrcdoc(code, { runId, loopLimitMs })
  host.appendChild(iframe)
  armTimer()

  return { stop: dispose }
}
