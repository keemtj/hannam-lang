import { compile, MzScriptSyntaxError } from "@mzscript/core"

export interface CompileDiagnostic {
  /** 1부터 시작하는 줄 번호 */
  line: number
  /** 0부터 시작하는 열 번호 */
  column: number
  /** 소스 안의 시작·끝 오프셋 (에디터 밑줄용) */
  from: number
  to: number
  /** 위치·코드 조각을 뺀 짧은 메시지 */
  message: string
  /** core가 만든 전체 메시지 (위치와 코드 조각 포함) */
  fullMessage: string
}

export type CompileOutcome =
  | { ok: true; code: string }
  | { ok: false; diagnostic: CompileDiagnostic }

const FILENAME = "playground.mz"

/** .mz 소스를 JS로 바꾸고, 실패하면 에디터에 표시할 위치 정보를 돌려준다 */
export function compileSource(source: string): CompileOutcome {
  try {
    const { code } = compile(source, { filename: FILENAME })
    return { ok: true, code }
  } catch (e) {
    return { ok: false, diagnostic: toDiagnostic(source, e) }
  }
}

function toDiagnostic(source: string, e: unknown): CompileDiagnostic {
  if (e instanceof MzScriptSyntaxError) {
    const from = offsetAt(source, e.line, e.column)
    return {
      line: e.line,
      column: e.column,
      from,
      to: tokenEnd(source, from),
      message: shortMessage(e.message),
      fullMessage: e.message,
    }
  }
  // core가 예상하지 못한 에러를 던져도 화면이 깨지지 않게 첫 줄에 표시한다
  const message = e instanceof Error ? e.message : String(e)
  return { line: 1, column: 0, from: 0, to: tokenEnd(source, 0), message, fullMessage: message }
}

/** "메시지 (파일:줄:열)\n코드 조각"에서 앞의 메시지만 남긴다 */
export function shortMessage(message: string): string {
  const firstLine = message.split("\n")[0] ?? message
  return firstLine.replace(/\s*\([^()]*:\d+:\d+\)$/, "")
}

export function offsetAt(source: string, line: number, column: number): number {
  let offset = 0
  for (let l = 1; l < line; l++) {
    const nl = source.indexOf("\n", offset)
    if (nl === -1) return source.length
    offset = nl + 1
  }
  const lineEnd = source.indexOf("\n", offset)
  const max = lineEnd === -1 ? source.length : lineEnd
  return Math.min(offset + column, max)
}

/** 밑줄 범위: 에러 위치부터 공백 전까지. 줄 끝이면 한 글자 앞을 잡아 밑줄이 보이게 한다 */
function tokenEnd(source: string, from: number): number {
  let to = from
  while (to < source.length && !/\s/.test(source[to]!)) to++
  if (to > from) return to
  return Math.min(from + 1, source.length)
}
