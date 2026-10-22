export interface Position {
  line: number
  column: number
}

export class HannamSyntaxError extends SyntaxError {
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
    this.line = line
    this.column = column
    this.filename = filename
    this.frame = frame
  }
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
  return `${gutter}${text}\n${" ".repeat(gutter.length + column)}^`
}
