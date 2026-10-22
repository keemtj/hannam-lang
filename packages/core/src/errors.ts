export interface Position {
  line: number
  column: number
}

export class HannamSyntaxError extends SyntaxError {
  /** 위치와 코드 조각을 붙이기 전의 문구. 에디터 진단처럼 위치를 따로 보여 주는 곳에서 쓴다 */
  readonly rawMessage: string
  readonly line: number
  readonly column: number
  readonly filename: string | undefined
  readonly frame: string

  constructor(message: string, source: string, index: number, filename?: string) {
    const { line, column } = positionAt(source, index)
    const where = `${filename ?? "<입력>"}:${line}:${column + 1}`
    const frame = codeFrame(source, line, column)
    super(`${message} (${where})\n${frame}`)
    this.name = "HannamSyntaxError"
    this.rawMessage = message
    this.line = line
    this.column = column
    this.filename = filename
    this.frame = frame
  }
}

/** 변환은 계속하지만 사용자에게 알려야 하는 내용 (예: 확장자 없는 상대 경로 import) */
export interface HannamWarning {
  message: string
  line: number
  column: number
  filename: string | undefined
  frame: string
  /** 위치와 코드 조각을 붙인 전체 문구. 에러 메시지와 같은 모양이다 */
  text: string
}

export function createWarning(message: string, source: string, index: number, filename?: string): HannamWarning {
  const { line, column } = positionAt(source, index)
  const frame = codeFrame(source, line, column)
  const text = `${message} (${filename ?? "<입력>"}:${line}:${column + 1})\n${frame}`
  return { message, line, column, filename, frame, text }
}

export function positionAt(source: string, index: number): Position {
  let line = 1
  let lineStart = 0
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") {
      line++
      lineStart = i + 1
    }
  }
  return { line, column: index - lineStart }
}

function codeFrame(source: string, line: number, column: number): string {
  const text = source.split("\n")[line - 1] ?? ""
  const gutter = `${line} | `
  return `${gutter}${text}\n${" ".repeat(gutter.length + displayWidth(text.slice(0, column)))}^`
}

// 터미널과 고정폭 글꼴에서 한글·한자 같은 전각 문자는 두 칸을 차지한다. ^ 표시를 그 폭에 맞춘다
const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/

function displayWidth(text: string): number {
  let width = 0
  for (const ch of text) width += WIDE.test(ch) ? 2 : 1
  return width
}
