// JS 토큰 경계만 알아내는 가벼운 렉서.
// 키워드 인식은 변환기(compile.ts)가 하고, 렉서는 문자열·템플릿·주석·정규식을 건너뛰는 일만 한다.

export type TokenType =
  | "ws"
  | "newline"
  | "lineComment"
  | "blockComment"
  | "string"
  | "template"
  | "regex"
  | "number"
  | "ident"
  | "punct"
  | "eof"

export interface Token {
  type: TokenType
  start: number
  end: number
  value: string
  /** template 토큰일 때 `${` 다음부터 짝이 되는 `}` 직전까지의 범위 */
  exprs?: Array<{ start: number; end: number }>
  /** `.` 뒤의 프로퍼티 이름 (obj.of 처럼 키워드여도 키워드가 아님) */
  property?: boolean
}

export class LexError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message)
  }
}

const ID_START = /[\p{ID_Start}$_]/u
const ID_CONTINUE = /[\p{ID_Continue}$‌‍]/u

export const isIdStart = (ch: string | undefined) => ch !== undefined && ID_START.test(ch)
export const isIdContinue = (ch: string | undefined) => ch !== undefined && ID_CONTINUE.test(ch)

const PUNCTUATORS = [
  ">>>=", "...", "===", "!==", "**=", "<<=", ">>=", ">>>", "&&=", "||=", "??=",
  "=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=", "/=",
  "%=", "&=", "|=", "^=", "<<", ">>", "**",
]

const REGEX_AFTER_KEYWORDS = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw",
  "case", "do", "else", "yield", "await",
])

/** 직전 의미 있는 토큰을 보고 `/`가 정규식 시작인지 판단한다 */
export function regexAllowedAfter(prev: Token | null, prevClosedBlock = false): boolean {
  if (!prev) return true
  switch (prev.type) {
    case "number":
    case "string":
    case "template":
    case "regex":
      return false
    case "ident":
      return !prev.property && REGEX_AFTER_KEYWORDS.has(prev.value)
    case "punct":
      // 뒤에 붙는 i++ / 2 는 나눗셈
      if (prev.value === ")" || prev.value === "]" || prev.value === "++" || prev.value === "--") return false
      if (prev.value === "}") return prevClosedBlock
      return true
    default:
      return true
  }
}

/** 직전 토큰을 보고 프로퍼티 이름인지 표시한다 */
export function withContext(t: Token, prev: Token | null): Token {
  if (t.type === "ident" && prev?.type === "punct" && (prev.value === "." || prev.value === "?.")) t.property = true
  return t
}

export function readToken(src: string, pos: number, regexOK: boolean): Token {
  if (pos >= src.length) return { type: "eof", start: pos, end: pos, value: "" }
  const ch = src[pos]!

  if (ch === "\n") return tok("newline", pos, pos + 1)
  if (ch === "\r" && src[pos + 1] === "\n") return tok("newline", pos, pos + 2)
  if (/[ \t\r\f\v ﻿　]/.test(ch)) {
    let end = pos + 1
    while (end < src.length && /[ \t\r\f\v ﻿　]/.test(src[end]!) && !(src[end] === "\r" && src[end + 1] === "\n")) end++
    return tok("ws", pos, end)
  }

  if (ch === "/" && src[pos + 1] === "/") {
    let end = pos + 2
    while (end < src.length && src[end] !== "\n") end++
    if (src[end - 1] === "\r") end--
    return tok("lineComment", pos, end)
  }
  if (ch === "/" && src[pos + 1] === "*") {
    const close = src.indexOf("*/", pos + 2)
    if (close === -1) throw new LexError("블록 주석이 닫히지 않았습니다", pos)
    return tok("blockComment", pos, close + 2)
  }

  if (ch === '"' || ch === "'") return readString(src, pos, ch)
  if (ch === "`") return readTemplate(src, pos)

  if (ch === "/" && regexOK) return readRegex(src, pos)

  if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[pos + 1] ?? ""))) {
    let end = pos + 1
    while (end < src.length && /[0-9a-zA-Z_.]/.test(src[end]!)) {
      // 범위 연산자 `0..10`의 `..`는 숫자에 포함하지 않는다
      if (src[end] === "." && src[end + 1] === ".") break
      // 지수 표기의 부호 (1e-3)
      end++
      if (/[eE]/.test(src[end - 1]!) && /[+-]/.test(src[end] ?? "") && !/^0[xX]/.test(src.slice(pos, end))) end++
    }
    return tok("number", pos, end, src)
  }

  if (isIdStart(ch) || ch === "\\") {
    let end = pos + 1
    while (end < src.length && isIdContinue(src[end])) end++
    return tok("ident", pos, end, src)
  }
  if (ch === "#" && isIdStart(src[pos + 1])) {
    let end = pos + 2
    while (end < src.length && isIdContinue(src[end])) end++
    return tok("ident", pos, end, src)
  }

  for (const p of PUNCTUATORS) {
    if (src.startsWith(p, pos)) {
      // `a?.5:b` 같은 삼항은 `?.`가 아니다
      if (p === "?." && /[0-9]/.test(src[pos + 2] ?? "")) continue
      return tok("punct", pos, pos + p.length, src)
    }
  }
  return tok("punct", pos, pos + 1, src)
}

function tok(type: TokenType, start: number, end: number, src?: string): Token {
  return { type, start, end, value: src ? src.slice(start, end) : "" }
}

function readString(src: string, pos: number, quote: string): Token {
  let i = pos + 1
  while (i < src.length) {
    const c = src[i]
    if (c === "\\") {
      // CRLF 줄 이음은 세 글자
      i += src[i + 1] === "\r" && src[i + 2] === "\n" ? 3 : 2
      continue
    }
    if (c === quote) return tok("string", pos, i + 1, src)
    if (c === "\n") break
    i++
  }
  throw new LexError("문자열이 닫히지 않았습니다", pos)
}

function readRegex(src: string, pos: number): Token {
  let i = pos + 1
  let inClass = false
  while (i < src.length) {
    const c = src[i]
    if (c === "\\") {
      i += 2
      continue
    }
    if (c === "\n") break
    if (c === "[") inClass = true
    else if (c === "]") inClass = false
    else if (c === "/" && !inClass) {
      i++
      while (i < src.length && isIdContinue(src[i])) i++
      return tok("regex", pos, i, src)
    }
    i++
  }
  throw new LexError("정규식이 닫히지 않았습니다", pos)
}

/** 템플릿 리터럴 전체를 읽고, `${}` 안의 범위를 exprs에 기록한다 */
function readTemplate(src: string, pos: number): Token {
  const exprs: Array<{ start: number; end: number }> = []
  let i = pos + 1
  while (i < src.length) {
    const c = src[i]
    if (c === "\\") {
      i += 2
      continue
    }
    if (c === "`") {
      const t = tok("template", pos, i + 1, src)
      t.exprs = exprs
      return t
    }
    if (c === "$" && src[i + 1] === "{") {
      const exprStart = i + 2
      const exprEnd = skipBalanced(src, exprStart, "}")
      exprs.push({ start: exprStart, end: exprEnd })
      i = exprEnd + 1
      continue
    }
    i++
  }
  throw new LexError("템플릿 리터럴이 닫히지 않았습니다", pos)
}

/** pos부터 읽어서 깊이 0의 closer 위치를 돌려준다 (문자열·주석·정규식은 건너뜀) */
export function skipBalanced(src: string, pos: number, closer: string): number {
  let depth = 0
  let prev: Token | null = null
  let i = pos
  while (i < src.length) {
    const t = withContext(readToken(src, i, regexAllowedAfter(prev)), prev)
    if (t.type === "eof") break
    if (t.type === "punct") {
      if (t.value === "(" || t.value === "[" || t.value === "{") depth++
      else if (t.value === ")" || t.value === "]" || t.value === "}") {
        if (depth === 0) {
          if (t.value === closer) return t.start
          throw new LexError(`짝이 맞지 않는 '${t.value}'`, t.start)
        }
        depth--
      }
    }
    if (isSignificant(t)) prev = t
    i = t.end
  }
  throw new LexError(`'${closer}'를 찾지 못했습니다`, pos)
}

export function isSignificant(t: Token): boolean {
  return t.type !== "ws" && t.type !== "newline" && t.type !== "lineComment" && t.type !== "blockComment"
}
