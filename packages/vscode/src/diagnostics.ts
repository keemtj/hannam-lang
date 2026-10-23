import { MzScriptSyntaxError, compile } from "@mzscript/core"

// vscode API에 기대지 않는 진단 계산. 확장(extension.ts)이 이 결과를 vscode.Diagnostic으로 옮긴다
export interface HnDiagnostic {
  severity: "error" | "warning"
  message: string
  /** 0부터 센 줄 번호 (VS Code Position과 같은 기준) */
  line: number
  /** 0부터 센 UTF-16 칸. VS Code Position과 같은 기준이다 */
  startColumn: number
  endColumn: number
}

/** source를 컴파일해 에러 하나와 경고들을 진단으로 돌려준다. 에러가 나면 그 뒤는 검사하지 않는다 */
export function collectDiagnostics(source: string, filename?: string): HnDiagnostic[] {
  try {
    const { warnings } = compile(source, { filename })
    return warnings.map((w) => at(source, "warning", w.message, w.line, w.column))
  } catch (e) {
    if (e instanceof MzScriptSyntaxError) return [at(source, "error", e.rawMessage, e.line, e.column)]
    throw e
  }
}

// 밑줄 범위: 그 위치에서 시작하는 토큰(공백 전까지). 줄 끝이나 공백 위라면 한 칸만 칠한다
function at(source: string, severity: HnDiagnostic["severity"], message: string, line: number, column: number): HnDiagnostic {
  const text = source.split(/\r?\n/)[line - 1] ?? ""
  const start = Math.min(column, text.length)
  const rest = text.slice(start)
  const length = rest.search(/\s/) === -1 ? rest.length : rest.search(/\s/)
  return { severity, message, line: line - 1, startColumn: start, endColumn: start + Math.max(length, 1) }
}
