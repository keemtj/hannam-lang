import MagicString, { type SourceMap } from "magic-string"
import { MzScriptSyntaxError, type MzScriptWarning, createWarning } from "./errors.js"
import {
  LexError,
  type Token,
  isIdContinue,
  isIdStart,
  isSignificant,
  readToken,
  regexAllowedAfter,
  skipBalanced,
  withContext,
} from "./lexer.js"

export interface CompileOptions {
  /** 에러 메시지와 소스맵에 쓸 파일 이름 */
  filename?: string
  /** 상대 경로 import의 `.mz`를 `.js`로 바꿀지 여부 (mzc 출력용) */
  rewriteImports?: boolean
  /** `__mz` 런타임을 가져올 모듈 이름 */
  runtimeImport?: string
}

export interface CompileResult {
  code: string
  map: SourceMap
  /** 변환은 했지만 알려야 하는 내용. 없으면 빈 배열이다 */
  warnings: MzScriptWarning[]
}

type FrameKind = "top" | "block" | "obj" | "paren" | "bracket" | "switch" | "class" | "tmpl"

interface Frame {
  kind: FrameKind
  open: number
  tag?: string
  switchVar?: string
  armCount?: number
  sawDefault?: boolean
}

interface PendingBrace {
  kind: "block" | "switch" | "class"
  tag: string
  switchVar?: string
}

const STATEMENT_KINDS = new Set<FrameKind>(["top", "block", "switch"])
const IF_TAGS = new Set(["if", "elseif"])

const CONFIRM = "예? 무슨 발언이세요?"
const CONSOLE = "무슨 발언이세요?"
const RETURN = "아! 줴줴이야~"
const THROW = "아... 줴줴이야..."
const AWAIT = "티~원!"

function synthetic(value: string, type: Token["type"] = "ident"): Token {
  return { type, start: -1, end: -1, value }
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  return new Compiler(source, options).run()
}

class Compiler {
  private readonly s: MagicString
  private readonly warnings: MzScriptWarning[] = []
  private readonly pending = new Map<number, PendingBrace>()
  private switchCount = 0
  private usesRuntime = false

  constructor(
    private readonly src: string,
    private readonly opts: CompileOptions,
  ) {
    this.s = new MagicString(src)
  }

  run(): CompileResult {
    let start = 0
    if (this.src.startsWith("#!")) {
      const nl = this.src.indexOf("\n")
      start = nl === -1 ? this.src.length : nl
    }
    try {
      this.processRange(start, this.src.length, [{ kind: "top", open: 0 }])
    } catch (e) {
      if (e instanceof LexError) throw this.error(e.message, e.index)
      throw e
    }
    if (this.usesRuntime) {
      // import는 끌어올려지므로 맨 끝에 붙여서 .mz 원본과 줄 번호를 맞춘다
      const from = this.opts.runtimeImport ?? "mzscript/runtime"
      this.s.append(`${this.src.endsWith("\n") ? "" : "\n"}import { __mz } from ${JSON.stringify(from)}\n`)
    }
    const file = this.opts.filename
    return {
      code: this.s.toString(),
      map: this.s.generateMap({
        source: file,
        file: file?.replace(/\.mz$/, ".js"),
        includeContent: true,
        hires: true,
      }),
      warnings: this.warnings,
    }
  }

  // ───────────────────────── 메인 루프 ─────────────────────────

  private processRange(from: number, to: number, stack: Frame[]): void {
    const src = this.src
    let pos = from
    let prev = null as Token | null
    let prevPrev = null as Token | null
    let prevClosedBlock = false
    let atStmtStart = stack.length === 1 && stack[0]!.kind === "top"
    let atLineStart = atStmtStart
    let lastClosed: string | null = null
    let pendingClassDepth: number | null = null
    // 헤더·문장을 처리하는 동안에는 그 깊이의 줄바꿈을 문장 시작으로 보지 않는다
    let guards: Array<{ depth: number; end: number }> = []
    const isTemplate = stack[0]!.kind === "tmpl"

    const top = () => stack[stack.length - 1]!
    const stmtCtx = () => STATEMENT_KINDS.has(top().kind)
    const setPrev = (t: Token) => {
      prevPrev = prev
      prev = t
    }

    // 키워드 처리기가 상태를 바꿀 때 쓰는 핸들
    const state: MemeState = {
      setPrev,
      endStatementStart: () => {
        atStmtStart = false
      },
      lastClosed: () => lastClosed,
      guard: (end: number) => {
        guards.push({ depth: stack.length, end })
      },
      top,
    }

    while (pos < to) {
      const c = src[pos]!

      // 공백·줄바꿈·주석
      if (c === " " || c === "\t" || c === "\n" || c === "\r" || (c === "/" && (src[pos + 1] === "/" || src[pos + 1] === "*")) || c === "\u00a0" || c === "\ufeff" || c === "\u3000") {
        const t = readToken(src, pos, false)
        if (t.type === "newline" || (t.type === "blockComment" && t.value.includes("\n"))) {
          atLineStart = true
          guards = guards.filter((g) => pos < g.end)
          const guarded = guards.some((g) => g.depth === stack.length)
          if (stmtCtx() && !guarded && !continuesStatement(prev)) atStmtStart = true
        }
        pos = t.end
        continue
      }

      if (atStmtStart && stmtCtx()) {
        const next = top().kind === "switch" ? this.switchArm(pos, state) : this.statementMeme(pos, state)
        if (next !== null) {
          // 주석이 아닌 문장이 오면 `} 예??`의 '바로 뒤' 조건이 깨진다
          if (!src.startsWith("엄...", pos)) lastClosed = null
          atLineStart = false
          pos = next
          continue
        }
      } else if (atLineStart && !isTemplate && src.startsWith("엄...", pos)) {
        // 클래스 본문·객체·괄호 안의 줄 맨 앞 주석
        const next = this.um(pos, state)
        if (next !== null) {
          pos = next
          continue
        }
      }

      if (isTemplate && prev === null && this.looksLikeStatementMeme(pos) && !src.startsWith(AWAIT, pos) && !src.startsWith(CONFIRM, pos)) {
        throw this.error("템플릿의 ${} 안에는 '티~원!', '예? 무슨 발언이세요?(...)' 같은 값 위치 키워드만 쓸 수 있습니다", pos)
      }

      atLineStart = false
      const value = this.valueMeme(pos, state)
      if (value !== null) {
        atStmtStart = false
        lastClosed = null
        pos = value
        continue
      }

      if (c === "…") throw this.error("말줄임표 '…' 대신 마침표 3개 '...'를 쓰세요 (모바일 자동 변환일 수 있습니다)", pos)
      if (c === "“" || c === "”" || c === "‘" || c === "’") {
        throw this.error(`둥근 따옴표 '${c}' 대신 일반 따옴표를 쓰세요 (모바일 자동 변환일 수 있습니다)`, pos)
      }

      const t = withContext(readToken(src, pos, regexAllowedAfter(prev, prevClosedBlock)), prev)
      pos = t.end
      prevClosedBlock = false
      const keepStmtStart = atStmtStart && t.type === "ident" && (t.value === "export" || (t.value === "default" && prev?.value === "export"))

      if (t.type === "template") {
        for (const e of t.exprs ?? []) this.processRange(e.start, e.end, [{ kind: "tmpl", open: e.start }])
      } else if (t.type === "string") {
        this.checkImport(t, prev, prevPrev)
      } else if (t.type === "ident" && t.value === "class" && !t.property && src[this.skipWs(t.end)] !== ":") {
        pendingClassDepth = stack.length
      } else if (t.type === "punct") {
        const v = t.value
        if (v === "(" || v === "[") {
          stack.push({ kind: v === "(" ? "paren" : "bracket", open: t.start })
        } else if (v === "{") {
          const p = this.pending.get(t.start)
          let frame: Frame
          if (p) {
            frame = { kind: p.kind, open: t.start, tag: p.tag, switchVar: p.switchVar, armCount: 0, sawDefault: false }
            guards = guards.filter((g) => g.end !== t.start)
          } else if (pendingClassDepth === stack.length) {
            frame = { kind: "class", open: t.start }
          } else {
            frame = { kind: isBlockBrace(prev, prevPrev, atStmtStart, top().kind) ? "block" : "obj", open: t.start }
          }
          if (frame.kind === "class") pendingClassDepth = null
          stack.push(frame)
          setPrev(t)
          lastClosed = null
          atStmtStart = frame.kind === "block" || frame.kind === "switch"
          continue
        } else if (v === ")" || v === "]" || v === "}") {
          const frame = stack.pop()
          const want = v === ")" ? ["paren"] : v === "]" ? ["bracket"] : ["block", "obj", "switch", "class"]
          if (!frame || !want.includes(frame.kind)) throw this.error(`짝이 맞지 않는 '${v}'`, t.start)
          if (v === "}" && frame.kind !== "obj") {
            setPrev(t)
            prevClosedBlock = true
            lastClosed = frame.tag ?? "block"
            atStmtStart = stmtCtx()
            continue
          }
        } else if (v === ";") {
          setPrev(t)
          lastClosed = null
          atStmtStart = stmtCtx()
          continue
        }
      }

      if (isSignificant(t)) {
        setPrev(t)
        lastClosed = null
        atStmtStart = keepStmtStart
      }
    }

    const last = stack[stack.length - 1]!
    if (stack.length > 1 || (last.kind !== "top" && last.kind !== "tmpl")) {
      throw this.error("닫히지 않은 괄호가 있습니다", last.open)
    }
  }

  // ───────────────────────── 문장 시작 키워드 ─────────────────────────

  private statementMeme(pos: number, st: MemeState): number | null {
    const src = this.src
    const c = src[pos]

    if (c === "엄") return this.um(pos, st)

    if (c === "예" && src[pos + 1] === "?") {
      if (src.startsWith(CONFIRM, pos)) {
        this.checkConfirmStatement(pos)
        return null // 값 위치 키워드로 처리
      }
      let q = 0
      while (src[pos + 1 + q] === "?") q++
      const after = src[pos + 1 + q]
      if (q >= 4) throw this.error(`'예'의 물음표는 1~3개만 쓸 수 있습니다 (${q}개)`, pos)
      if (after !== " " && after !== "\t") return null // 예?.x 같은 일반 JS
      const kwEnd = pos + 1 + q
      if (q === 1) return this.headerKeyword(pos, kwEnd, "if", "if", st)
      if (q === 2) {
        if (!IF_TAGS.has(st.lastClosed() ?? "")) throw this.error("'예??'(else if)는 '예?' 블록의 '}' 바로 뒤에서만 쓸 수 있습니다", pos)
        return this.headerKeyword(pos, kwEnd, "else if", "elseif", st)
      }
      return this.switchHead(pos, kwEnd, st)
    }

    if (src.startsWith(CONSOLE, pos)) return this.consoleLog(pos, st)

    if (c === "아") {
      if (src.startsWith(THROW, pos) && src[pos + THROW.length] !== ".") return this.throwStmt(pos, st)
      if (src.startsWith(RETURN, pos)) return this.returnStmt(pos, st)
      const m = /^(?:아뇨)+/.exec(src.slice(pos, pos + 64))
      if (m && !isIdContinue(src[pos + m[0].length])) return this.anyo(pos, m[0].length / 2, st)
      if (/^아[!.]+ ?줴줴이야/.test(src.slice(pos, pos + 16))) {
        throw this.error("return은 '아! 줴줴이야~', throw는 '아... 줴줴이야...'로 씁니다", pos)
      }
      return null
    }

    if (c === "줴" && src.startsWith("줴줴이야", pos) && !isIdContinue(src[pos + 4])) {
      this.requireStatementEnd(pos + 4, "'줴줴이야'(break) 뒤에는 다른 값을 쓸 수 없습니다")
      this.s.update(pos, pos + 4, "break")
      st.setPrev(synthetic("break"))
      st.endStatementStart()
      return pos + 4
    }

    if (c === "진" && src.startsWith("진~지", pos)) {
      if (src[pos + 3] !== "?") throw this.error("try는 물음표까지 붙여 '진~지?'로 씁니다", pos)
      const brace = this.skipWs(pos + 4)
      if (src[brace] !== "{") throw this.error("'진~지?' 뒤에는 '{'가 와야 합니다", brace)
      this.s.update(pos, pos + 4, "try")
      this.pending.set(brace, { kind: "block", tag: "try" })
      st.endStatementStart()
      return pos + 4
    }

    // 키워드 표기에서 물결이 빠진 형태는 catch·try로 쓰려던 것이라 안내한다 (일반 식별자 대입 `지랄 = 1` 등은 그대로)
    if (/^(?:지-?랄|진지\?)[ \t]+[\p{ID_Start}$_({[]/u.test(src.slice(pos, pos + 16)) && !src.startsWith("지~랄", pos)) {
      throw this.error(src[pos + 1] === "지" ? "try는 '진~지?'로 씁니다" : "catch는 '지~랄'로 씁니다", pos)
    }

    if (c === "지" && src.startsWith("지~랄", pos) && !isIdContinue(src[pos + 3])) {
      if (st.lastClosed() !== "try") throw this.error("'지~랄'(catch)은 '진~지?' 블록의 '}' 바로 뒤에서만 쓸 수 있습니다", pos)
      return this.catchHead(pos, st)
    }

    if (c === "티") {
      if (src.startsWith(AWAIT, pos)) return null // 값 위치 키워드
      const fn = src.startsWith("티-원", pos) ? "function" : src.startsWith("티~원", pos) ? "async function" : null
      if (!fn) return null
      const nameAt = this.skipInlineWs(pos + 3)
      if (nameAt === pos + 3) return null
      if (src[nameAt] === "(") throw this.error("화살표 함수는 '티~원'이 아니라 JS의 async를 그대로 씁니다", pos)
      if (!isIdStart(src[nameAt])) throw this.error("함수 이름이 필요합니다", nameAt)
      this.s.update(pos, pos + 3, fn)
      st.setPrev(synthetic("function"))
      st.endStatementStart()
      return pos + 3
    }

    if (c === "오" && /^오[호홋콧]+~/.test(src.slice(pos, pos + 16))) return this.classHead(pos, st)
    if (c === "오" && /^오[호홋콧]+[ \t]+[\p{ID_Start}$_][\p{ID_Continue}$]*[^\n{]*\{/u.test(src.slice(pos, pos + 80))) {
      throw this.error("클래스는 물결까지 붙여 '오호호호호~', 상속은 '오호호호홋~'로 씁니다", pos)
    }

    if (c === "요" && /^요[이히]+~/.test(src.slice(pos, pos + 16))) {
      if (src.startsWith("요이이이~", pos)) return this.headerKeyword(pos, pos + 5, "while", "loop", st)
      if (src.startsWith("요이~", pos)) return this.forHead(pos, pos + 3, false, st)
      if (src.startsWith("요히~", pos)) return this.forHead(pos, pos + 3, true, st)
      throw this.error("반복문은 '요이~'(for...of), '요히~'(for...in), '요이이이~'(while)만 쓸 수 있습니다", pos)
    }

    return null
  }

  /** 엄 가족: var / let / const / 주석 */
  private um(pos: number, st: MemeState): number | null {
    const src = this.src
    let dots = 0
    while (src[pos + 1 + dots] === ".") dots++
    if (dots > 3) throw this.error("'엄' 뒤의 점은 3개까지만 쓸 수 있습니다", pos)
    const end = pos + 1 + dots
    const after = src[end]
    if (dots === 3) {
      if (after !== undefined && after !== " " && after !== "\t" && after !== "\n" && after !== "\r") return null
      let eol = end
      while (eol < src.length && src[eol] !== "\n") eol++
      if (src[eol - 1] === "\r") eol--
      this.s.update(pos, end, "//")
      return eol
    }
    if (after !== " " && after !== "\t") {
      // 엄.length, 엄마 같은 일반 JS는 그대로. `엄..x`는 JS에서도 문법 오류라 안내한다
      if (dots === 2 && (isIdStart(after) || after === "{" || after === "[")) throw this.error("'엄..' 뒤에는 띄어 쓰고 이름을 적습니다", end)
      return null
    }
    const nameAt = this.skipInlineWs(end)
    const n = src[nameAt]
    const isDecl = isIdStart(n) || n === "{" || n === "["
    if (!isDecl) {
      if (dots === 0) return null // `엄 = 1` 같은 대입
      throw this.error("선언할 이름이 필요합니다", nameAt)
    }
    const nameMatch = /^[\p{ID_Start}$_][\p{ID_Continue}$]*/u.exec(src.slice(nameAt, nameAt + 64))
    if (nameMatch && /^(?:(?:아뇨)+|줴줴이야)$/.test(nameMatch[0])) {
      throw this.error(`'${nameMatch[0]}'는 예약어라 변수 이름으로 쓸 수 없습니다`, nameAt)
    }
    const kw = dots === 0 ? "var" : dots === 1 ? "let" : "const"
    this.s.update(pos, end, kw)
    st.setPrev(synthetic("const"))
    st.endStatementStart()
    return end
  }

  /** `키워드 헤더 {` → `js키워드 (헤더) {` */
  private headerKeyword(pos: number, kwEnd: number, js: string, tag: string, st: MemeState): number {
    if (this.src[kwEnd] !== " " && this.src[kwEnd] !== "\t") throw this.error("키워드 뒤에는 띄어 쓰고 조건을 적습니다", kwEnd)
    const headStart = this.skipWs(kwEnd)
    const brace = this.findHeaderBrace(headStart)
    const headEnd = this.lastSignificantEnd(headStart, brace)
    if (headEnd <= headStart) throw this.error("조건이 필요합니다", headStart)
    if (this.isWrapped(headStart, headEnd)) {
      this.s.update(pos, headStart, `${js} `)
    } else {
      this.s.update(pos, headStart, `${js} (`)
      this.closeHeader(headEnd, brace)
    }
    this.pending.set(brace, { kind: "block", tag })
    st.guard(brace)
    st.setPrev(synthetic("(", "punct"))
    st.endStatementStart()
    return headStart
  }

  /** `예??? 값 {` → `{ const __mz_s0 = 값;` (갈래는 if-else 체인) */
  private switchHead(pos: number, kwEnd: number, st: MemeState): number {
    const headStart = this.skipWs(kwEnd)
    const brace = this.findHeaderBrace(headStart)
    const headEnd = this.lastSignificantEnd(headStart, brace)
    if (headEnd <= headStart) throw this.error("비교할 값이 필요합니다", headStart)
    const comma = this.topLevelCommas(headStart, headEnd)[0]
    if (comma !== undefined) throw this.error("'예???'로 비교할 값은 하나만 씁니다", comma)
    const switchVar = `__mz_s${this.switchCount++}`
    this.s.update(pos, headStart, `{ const ${switchVar} = `)
    if (this.onlyWhitespace(headEnd, brace)) {
      this.s.update(headEnd, brace + 1, ";")
    } else {
      this.s.appendLeft(headEnd, ";")
      this.s.update(brace, brace + 1, "")
    }
    this.pending.set(brace, { kind: "switch", tag: "switch", switchVar })
    st.guard(brace)
    st.setPrev(synthetic("=", "punct"))
    st.endStatementStart()
    return headStart
  }

  /** `예???` 블록 안: `값, 값 {` 갈래 또는 `아뇨아뇨아뇨아뇨 {` 기본 갈래 */
  private switchArm(pos: number, st: MemeState): number | null {
    const src = this.src
    const frame = st.top()
    if (src[pos] === "}") return null
    if (src.startsWith("엄...", pos)) return this.um(pos, st)
    if (src[pos] === ";") throw this.error("'예???' 갈래 사이에는 ';'를 쓰지 않습니다", pos)

    const m = /^(?:아뇨)+/.exec(src.slice(pos, pos + 64))
    if (m && m[0].length === 8 && !isIdContinue(src[pos + 8])) {
      if (frame.sawDefault) throw this.error("'아뇨아뇨아뇨아뇨' 갈래는 한 번만 쓸 수 있습니다", pos)
      const brace = this.skipWs(pos + 8)
      if (src[brace] !== "{") throw this.error("'아뇨아뇨아뇨아뇨' 뒤에는 '{'가 와야 합니다", brace)
      if (frame.armCount! > 0) this.s.update(pos, pos + 8, "else")
      else this.s.update(pos, brace, "")
      frame.armCount!++
      frame.sawDefault = true
      this.pending.set(brace, { kind: "block", tag: "arm" })
      st.endStatementStart()
      return pos + 8
    }

    if (this.looksLikeStatementMeme(pos)) throw this.error("'예???' 블록 안에는 '값 {' 갈래만 쓸 수 있습니다", pos)
    if (frame.sawDefault) throw this.error("'아뇨아뇨아뇨아뇨' 갈래는 마지막에 와야 합니다", pos)

    const brace = this.findHeaderBrace(pos)
    const headEnd = this.lastSignificantEnd(pos, brace)
    if (headEnd <= pos) throw this.error("갈래에 비교할 값이 필요합니다", pos)
    const v = frame.switchVar!
    // 값마다 [시작, 끝) 범위. `1 || 5`처럼 연산자가 있으면 괄호로 감싸 JS switch의 case와 같게 비교한다
    const values: Array<[number, number]> = []
    let valueStart = pos
    for (const comma of this.topLevelCommas(pos, headEnd)) {
      values.push([valueStart, this.lastSignificantEnd(valueStart, comma)])
      valueStart = this.skipWs(comma + 1)
      if (valueStart >= headEnd) throw this.error("쉼표 뒤에 값이 필요합니다", comma)
    }
    values.push([valueStart, headEnd])

    values.forEach(([vs, ve], i) => {
      if (ve <= vs) throw this.error("쉼표 앞에 값이 필요합니다", vs)
      const prefix = i === 0 ? `${frame.armCount! > 0 ? "else if" : "if"} (${v} === ` : ` || ${v} === `
      if (i === 0) this.s.appendRight(vs, prefix)
      else this.s.update(values[i - 1]![1], vs, prefix)
      if (this.needsParens(vs, ve)) {
        this.s.appendRight(vs, "(")
        this.s.appendLeft(ve, ")")
      }
    })
    this.closeHeader(headEnd, brace)
    frame.armCount!++
    this.pending.set(brace, { kind: "block", tag: "arm" })
    st.guard(brace)
    st.setPrev(synthetic("(", "punct"))
    st.endStatementStart()
    return pos
  }

  /** `아뇨` = continue, `아뇨아뇨아뇨아뇨` = else */
  private anyo(pos: number, count: number, st: MemeState): number {
    const src = this.src
    if (count === 1) {
      this.requireStatementEnd(pos + 2, "'아뇨'(continue) 뒤에는 다른 값을 쓸 수 없습니다")
      this.s.update(pos, pos + 2, "continue")
      st.setPrev(synthetic("continue"))
      st.endStatementStart()
      return pos + 2
    }
    if (count !== 4) throw this.error(`'아뇨'는 1번(continue) 또는 4번(else)만 씁니다 (${count}번)`, pos)
    if (!IF_TAGS.has(st.lastClosed() ?? "")) throw this.error("'아뇨아뇨아뇨아뇨'(else)는 '예?' 블록의 '}' 바로 뒤에서만 쓸 수 있습니다", pos)
    const brace = this.skipWs(pos + 8)
    if (src[brace] !== "{") throw this.error("'아뇨아뇨아뇨아뇨' 뒤에는 '{'가 와야 합니다", brace)
    this.s.update(pos, pos + 8, "else")
    this.pending.set(brace, { kind: "block", tag: "else" })
    st.endStatementStart()
    return pos + 8
  }

  /** `무슨 발언이세요? 값` → `console.log(값)` */
  private consoleLog(pos: number, st: MemeState): number | null {
    const src = this.src
    const kwEnd = pos + CONSOLE.length
    const after = src[kwEnd]
    if (after === "(") throw this.error("'무슨 발언이세요?' 뒤에는 띄어 쓰고 값을 적습니다 (괄호를 붙이지 않음)", kwEnd)
    if (after === "?") throw this.error("'무슨 발언이세요?'의 물음표는 1개입니다", kwEnd)
    if (after !== undefined && !/[ \t\r\n};]/.test(after)) return null
    const argsStart = this.skipInlineWs(kwEnd)
    const argsEnd = this.statementEnd(argsStart)
    if (argsEnd <= argsStart) {
      this.s.update(pos, kwEnd, "console.log()")
      st.setPrev(synthetic(")", "punct"))
      st.endStatementStart()
      return kwEnd
    } else {
      if (src[argsStart] === "(" && this.isWrapped(argsStart, argsEnd) && this.topLevelCommas(argsStart + 1, argsEnd - 1).length > 0) {
        throw this.error("쉼표로 여러 값을 넘길 때는 괄호로 감싸지 않습니다 (JS 쉼표 연산자가 되어 마지막 값만 출력됨)", argsStart)
      }
      this.s.update(pos, argsStart, "console.log(")
      this.s.appendLeft(argsEnd, ")")
      st.guard(argsEnd)
    }
    st.setPrev(synthetic("(", "punct"))
    st.endStatementStart()
    return argsStart
  }

  /** `아! 줴줴이야~ 값` → `return 값` */
  private returnStmt(pos: number, st: MemeState): number {
    const end = pos + RETURN.length
    const after = this.src[end]
    if (after !== undefined && !/[ \t\r\n};]/.test(after)) throw this.error("'아! 줴줴이야~' 뒤에는 띄어 쓰고 값을 적습니다", end)
    this.s.update(pos, end, "return")
    st.setPrev(synthetic("return"))
    st.endStatementStart()
    return end
  }

  /** `아... 줴줴이야... 값` → `throw new Error(값)` 등 */
  private throwStmt(pos: number, st: MemeState): number {
    const src = this.src
    const end = pos + THROW.length
    const valueStart = this.skipInlineWs(end)
    const valueEnd = this.statementEnd(valueStart)
    if (valueEnd <= valueStart) throw this.error("던질 값이 필요합니다", pos)
    this.s.update(pos, valueStart, "throw ")
    const tokens = this.significantTokens(valueStart, valueEnd)
    const only = tokens.length === 1 ? tokens[0]! : null
    if (only && (only.type === "string" || only.type === "template")) {
      this.s.appendRight(valueStart, "new Error(")
      this.s.appendLeft(valueEnd, ")")
    } else if (!/^new\s/.test(src.slice(valueStart, valueEnd))) {
      this.usesRuntime = true
      this.s.appendRight(valueStart, "__mz.toError(")
      this.s.appendLeft(valueEnd, ")")
    }
    st.guard(valueEnd)
    st.setPrev(synthetic("throw"))
    st.endStatementStart()
    return valueStart
  }

  /** `} 지~랄 e {` → `} catch (e) {` */
  private catchHead(pos: number, st: MemeState): number {
    const src = this.src
    const headStart = this.skipWs(pos + 3)
    const p = src[headStart]
    // 구조분해 `지~랄 { message } {`: `{ ... }` 바로 뒤에 `{`가 또 오면 앞쪽은 패턴이다 (`지~랄 {`만 있으면 본문)
    const isPattern =
      p === "[" || (p === "{" && src[this.skipWs(skipBalanced(src, headStart + 1, "}") + 1)] === "{")
    if (isPattern) {
      const patEnd = skipBalanced(src, headStart + 1, p === "{" ? "}" : "]") + 1
      const brace = this.findHeaderBrace(patEnd)
      if (this.lastSignificantEnd(patEnd, brace) > patEnd) throw this.error("에러 변수 뒤에는 '{'가 와야 합니다", patEnd)
      this.s.update(pos, headStart, "catch (")
      this.s.appendLeft(patEnd, ")")
      this.pending.set(brace, { kind: "block", tag: "catch" })
      st.guard(brace)
      st.setPrev(synthetic("(", "punct"))
      st.endStatementStart()
      return headStart
    }
    const brace = this.findHeaderBrace(headStart)
    const headEnd = this.lastSignificantEnd(headStart, brace)
    if (headEnd <= headStart) {
      this.s.update(pos, pos + 3, "catch")
    } else if (this.isWrapped(headStart, headEnd)) {
      this.s.update(pos, headStart, "catch ")
    } else {
      this.s.update(pos, headStart, "catch (")
      this.closeHeader(headEnd, brace)
    }
    this.pending.set(brace, { kind: "block", tag: "catch" })
    st.guard(brace)
    st.setPrev(synthetic("(", "punct"))
    st.endStatementStart()
    return headStart
  }

  /** `오호호호호~ 이름 {` → class, `오호호호홋~ 이름 부모 {` → class extends */
  private classHead(pos: number, st: MemeState): number {
    const src = this.src
    const isExtends = src.startsWith("오호호호홋~", pos)
    if (!isExtends && !src.startsWith("오호호호호~", pos)) {
      throw this.error("클래스는 '오호호호호~', 상속은 '오호호호홋~'로만 씁니다", pos)
    }
    const kwEnd = pos + 6
    const nameStart = this.skipInlineWs(kwEnd)
    if (nameStart === kwEnd || !isIdStart(src[nameStart])) throw this.error("클래스 이름이 필요합니다", nameStart)
    let nameEnd = nameStart + 1
    while (isIdContinue(src[nameEnd])) nameEnd++
    const brace = this.findHeaderBrace(nameEnd)
    const restStart = this.skipWs(nameEnd)
    const restEnd = this.lastSignificantEnd(nameEnd, brace)
    const hasRest = restEnd > restStart
    if (!isExtends && hasRest) {
      const word = src.slice(restStart, restStart + 7)
      throw this.error(word === "extends" ? "상속은 'extends' 대신 '오호호호홋~ 이름 부모 {'로 씁니다" : "클래스 이름 뒤에는 '{'가 와야 합니다", restStart)
    }
    if (isExtends) {
      if (!hasRest) throw this.error("상속할 부모 클래스가 필요합니다", restStart)
      if (restStart === nameEnd) throw this.error("클래스 이름과 부모 클래스 사이를 띄어 씁니다", nameEnd)
      if (/^extends\b/.test(src.slice(restStart, restEnd))) throw this.error("'오호호호홋~'에는 'extends'를 쓰지 않습니다", restStart)
      this.s.update(nameEnd, restStart, " extends ")
    }
    this.s.update(pos, nameStart, "class ")
    this.pending.set(brace, { kind: "class", tag: "class" })
    st.guard(brace)
    st.setPrev(synthetic("class"))
    st.endStatementStart()
    return nameStart
  }

  /** `요이~ 항목 목록 {`, `요이~ i a..b {`, `요히~ 키 객체 {` */
  private forHead(pos: number, kwEnd: number, isIn: boolean, st: MemeState): number {
    const src = this.src
    const patStart = this.skipInlineWs(kwEnd)
    if (patStart === kwEnd) throw this.error("반복 키워드 뒤에는 띄어 쓰고 변수 이름을 적습니다", kwEnd)
    let patEnd: number
    const p = src[patStart]
    if (p === "[" || p === "{") {
      patEnd = skipBalanced(src, patStart + 1, p === "[" ? "]" : "}") + 1
    } else if (isIdStart(p)) {
      patEnd = patStart + 1
      while (isIdContinue(src[patEnd])) patEnd++
    } else {
      throw this.error("반복할 변수 이름이 필요합니다", patStart)
    }
    const iterStart = this.skipWs(patEnd)
    if (iterStart === patEnd) throw this.error("변수 이름 뒤에는 띄어 쓰고 반복할 대상을 적습니다", patEnd)
    const brace = this.findHeaderBrace(iterStart)
    const iterEnd = this.lastSignificantEnd(iterStart, brace)
    if (iterEnd <= iterStart) throw this.error("반복할 대상이 필요합니다", iterStart)

    const range = this.findRangeDots(iterStart, iterEnd)
    if (range !== -1 && isIn) throw this.error("범위 반복은 '요이~'로 씁니다 ('요히~'는 for...in)", range)
    if (range !== -1) {
      if (!isIdStart(p)) throw this.error("범위 반복의 변수는 이름 하나여야 합니다", patStart)
      const name = src.slice(patStart, patEnd)
      const aEnd = this.lastSignificantEnd(iterStart, range)
      const bStart = this.skipWs(range + 2)
      if (aEnd <= iterStart || bStart >= iterEnd) throw this.error("범위는 '시작..끝' 형태로 씁니다", range)
      const comma = this.topLevelCommas(iterStart, iterEnd)[0]
      if (comma !== undefined) throw this.error("범위의 시작과 끝에는 쉼표를 쓰지 않습니다", comma)
      this.s.update(pos, patStart, "for (let ")
      this.s.update(patEnd, iterStart, " = ")
      this.s.update(aEnd, bStart, `; ${name} < `)
      // `0..n || 10`처럼 연산자가 있으면 `i < (n || 10)`으로 감싼다
      if (this.needsParens(bStart, iterEnd)) {
        this.s.appendRight(bStart, "(")
        this.s.appendLeft(iterEnd, ")")
      }
      this.closeHeader(iterEnd, brace, `; ${name}++)`)
    } else {
      this.s.update(pos, patStart, "for (const ")
      this.s.update(patEnd, iterStart, isIn ? " in " : " of ")
      this.closeHeader(iterEnd, brace)
    }
    this.pending.set(brace, { kind: "block", tag: "loop" })
    st.guard(brace)
    st.setPrev(synthetic("const"))
    st.endStatementStart()
    return patStart
  }

  // ───────────────────────── 값 위치 키워드 ─────────────────────────

  private valueMeme(pos: number, st: MemeState): number | null {
    const src = this.src
    if (src.startsWith(AWAIT, pos) && !isIdContinue(src[pos - 1])) {
      const after = src[pos + AWAIT.length]
      if (after !== " " && after !== "\t") throw this.error("'티~원!' 뒤에는 띄어 쓰고 값을 적습니다", pos + AWAIT.length)
      this.s.update(pos, pos + AWAIT.length, "await")
      st.setPrev(synthetic("await"))
      return pos + AWAIT.length
    }
    if (src.startsWith(CONFIRM, pos) && !isIdContinue(src[pos - 1])) {
      const end = pos + CONFIRM.length
      if (src[end] !== "(") throw this.error("'예? 무슨 발언이세요?' 바로 뒤에 괄호로 질문을 넘깁니다", end)
      this.s.update(pos, end, "__mz.confirm")
      this.usesRuntime = true
      st.setPrev(synthetic("__mz"))
      return end
    }
    return null
  }

  /** 문장 맨 앞 `예? 무슨 발언이세요?(...) {`는 if로 착각하기 쉬워서 막는다 */
  private checkConfirmStatement(pos: number): void {
    const open = pos + CONFIRM.length
    if (this.src[open] !== "(") return
    const close = skipBalanced(this.src, open + 1, ")")
    if (this.src[this.skipInlineWs(close + 1)] === "{") {
      throw this.error("if 조건으로 쓰려면 '예? 예? 무슨 발언이세요?(...) {'처럼 '예?'를 한 번 더 씁니다", pos)
    }
  }

  // ───────────────────────── import ─────────────────────────

  private checkImport(t: Token, prev: Token | null, prevPrev: Token | null): void {
    const isSpecifier =
      (prev?.type === "ident" && (prev.value === "from" || prev.value === "import")) ||
      (prev?.value === "(" && prevPrev?.type === "ident" && prevPrev.value === "import")
    if (!isSpecifier) return
    const spec = t.value.slice(1, -1)
    if (!/^\.\.?\//.test(spec)) return
    const last = spec.split("/").pop() ?? ""
    // 일반 JS(번들러용 코드)는 확장자 없이 쓰는 경우가 많아서 막지 않는다. .mz를 가리키려던 실수일 수 있어 경고만 남긴다
    if (!last.includes(".")) {
      this.warnings.push(
        createWarning(`확장자가 없는 상대 경로 import입니다. .mz 파일이라면 확장자를 붙여야 찾을 수 있습니다 (예: "${spec}.mz")`, this.src, t.start, this.opts.filename),
      )
      return
    }
    if (this.opts.rewriteImports && spec.endsWith(".mz")) this.s.update(t.end - 4, t.end - 1, ".js")
  }

  // ───────────────────────── 보조 함수 ─────────────────────────

  private error(message: string, index: number): MzScriptSyntaxError {
    return new MzScriptSyntaxError(message, this.src, index, this.opts.filename)
  }

  private skipInlineWs(pos: number): number {
    while (pos < this.src.length && (this.src[pos] === " " || this.src[pos] === "\t")) pos++
    return pos
  }

  private skipWs(pos: number): number {
    while (pos < this.src.length && /\s/.test(this.src[pos]!)) pos++
    return pos
  }

  private onlyWhitespace(from: number, to: number): boolean {
    return /^\s*$/.test(this.src.slice(from, to))
  }

  /** 헤더 끝에 `)`를 넣는다. 헤더와 `{` 사이가 공백뿐이면 공백을 하나로 맞추고, 주석이 있으면 그대로 둔다 */
  private closeHeader(headEnd: number, brace: number, text = ")"): void {
    if (headEnd === brace) this.s.appendLeft(brace, `${text} `)
    else if (this.onlyWhitespace(headEnd, brace)) this.s.update(headEnd, brace, `${text} `)
    else this.s.appendLeft(headEnd, text)
  }

  /** [start, end)가 하나의 괄호 쌍으로 감싸져 있는지 */
  private isWrapped(start: number, end: number): boolean {
    if (this.src[start] !== "(") return false
    return skipBalanced(this.src, start + 1, ")") === end - 1
  }

  /** 식별자·리터럴 하나나 `a.b.c` 멤버 접근이 아니면 괄호가 필요하다 */
  private needsParens(start: number, end: number): boolean {
    const tokens = this.significantTokens(start, end)
    if (tokens.length === 1) return tokens[0]!.type === "punct"
    if (tokens.length === 2 && tokens[0]!.value === "-" && tokens[1]!.type === "number") return false
    return !tokens.every((t, i) => (i % 2 === 0 ? t.type === "ident" : t.value === "." || t.value === "?."))
  }

  private requireStatementEnd(pos: number, message: string): void {
    const i = this.skipInlineWs(pos)
    const c = this.src[i]
    if (c === undefined || c === "\n" || c === "\r" || c === "}" || c === ";" || this.src.startsWith("//", i) || this.src.startsWith("/*", i)) return
    throw this.error(message, i)
  }

  /** 문장 키워드처럼 보이는지 (식별자 경계까지 확인해서 `엄.a`, `아뇨값` 같은 일반 식별자는 제외) */
  private looksLikeStatementMeme(pos: number): boolean {
    const src = this.src
    if (src.startsWith(CONFIRM, pos) || src.startsWith(AWAIT, pos)) return false
    const head = src.slice(pos, pos + 16)
    return (
      /^엄\.{0,2}[ \t]+[\p{ID_Start}$_{[]/u.test(head) ||
      /^엄\.\.\.(\s|$)/.test(head) ||
      /^예\?+[ \t]/.test(head) ||
      head.startsWith(CONSOLE) ||
      /^아[!.]+ ?줴줴이야/.test(head) ||
      /^요[이히]+~/.test(head) ||
      /^티[-~]원[ \t]/.test(head) ||
      /^오[호홋]+~/.test(head) ||
      /^진~지/.test(head) ||
      /^(?:지~랄|줴줴이야|(?:아뇨)+)(?![\p{ID_Continue}])/u.test(head)
    )
  }

  /** 깊이 0에서 처음 나오는 `{`의 위치 (헤더의 끝) */
  private findHeaderBrace(from: number): number {
    const found = this.scan(from, this.src.length, (t, depth) => {
      if (depth === 0 && t.type === "punct") {
        if (t.value === "{") return t.start
        if (t.value === ")" || t.value === "]" || t.value === "}" || t.value === ";") throw this.error("블록을 여는 '{'가 필요합니다", from)
      }
      return undefined
    })
    if (found === undefined) throw this.error("블록을 여는 '{'가 필요합니다", from)
    return found
  }

  /** [from, to)에서 마지막 의미 있는 토큰의 끝 (뒤따르는 공백·주석은 제외) */
  private lastSignificantEnd(from: number, to: number): number {
    let end = from
    this.scan(from, to, (t) => {
      if (isSignificant(t)) end = t.end
      return undefined
    })
    return end
  }

  /**
   * 문장의 끝 (깊이 0의 줄바꿈, `;`, 닫는 괄호, 줄 주석 직전).
   * JS처럼 줄이 연산자·쉼표로 끝나거나 다음 줄이 `.`·연산자로 시작하면 다음 줄로 이어 읽는다.
   */
  private statementEnd(from: number): number {
    let lastEnd = from
    let last: Token | null = null
    this.scan(from, this.src.length, (t, depth) => {
      if (depth === 0) {
        if (t.type === "newline" || t.type === "lineComment") {
          // 문장 안의 깊이 0 `:`는 삼항식이므로 이어진다 (메인 루프에서는 case 레이블 끝으로 본다)
          if (last && (continuesStatement(last) || last.value === ":" || this.nextLineContinues(t.end))) return undefined
          return t.start
        }
        if (t.type === "punct" && (t.value === ";" || t.value === ")" || t.value === "]" || t.value === "}")) return t.start
      }
      if (isSignificant(t)) {
        lastEnd = t.end
        last = t
      }
      return undefined
    })
    return lastEnd
  }

  /** 다음 의미 있는 토큰이 앞 줄에 이어 붙는 형태(`.map`, `?.x`, `&& b` 등)인지 */
  private nextLineContinues(pos: number): boolean {
    let i = pos
    for (;;) {
      const t = readToken(this.src, i, false)
      if (t.type === "eof") return false
      if (isSignificant(t)) return t.type === "punct" && CONTINUATION_STARTS.has(t.value)
      i = t.end
    }
  }

  private topLevelCommas(from: number, to: number): number[] {
    const commas: number[] = []
    this.scan(from, to, (t, depth) => {
      if (depth === 0 && t.type === "punct" && t.value === ",") commas.push(t.start)
      return undefined
    })
    return commas
  }

  /** 깊이 0의 `..` (범위). `...`(스프레드)는 제외 */
  private findRangeDots(from: number, to: number): number {
    const src = this.src
    return (
      this.scan(from, to, (t, depth) => {
        if (depth === 0 && t.value === "." && src[t.end] === "." && src[t.end + 1] !== ".") return t.start
        return undefined
      }) ?? -1
    )
  }

  private significantTokens(from: number, to: number): Token[] {
    const out: Token[] = []
    this.scan(from, to, (t) => {
      if (isSignificant(t)) out.push(t)
      return undefined
    })
    return out
  }

  /**
   * [from, to) 범위의 토큰을 차례로 넘긴다. 콜백이 숫자를 돌려주면 멈추고 그 값을 돌려준다.
   * depth는 그 토큰을 읽기 전의 괄호 깊이. 범위 바깥 괄호를 닫는 토큰은 depth 0으로 넘어온다
   */
  private scan(from: number, to: number, fn: (t: Token, depth: number) => number | undefined): number | undefined {
    let depth = 0
    let prev: Token | null = null
    let i = from
    while (i < to) {
      const t = withContext(readToken(this.src, i, regexAllowedAfter(prev)), prev)
      if (t.type === "eof") break
      const isClose = t.type === "punct" && (t.value === ")" || t.value === "]" || t.value === "}")
      const isOpen = t.type === "punct" && (t.value === "(" || t.value === "[" || t.value === "{")
      if (isClose) {
        if (depth > 0) {
          // 안쪽 괄호를 닫는 토큰은 깊이 1 이상으로 넘겨서, 깊이 0 검사에 걸리지 않게 한다
          const r = fn(t, depth)
          depth--
          if (r !== undefined) return r
        } else {
          const r = fn(t, 0)
          if (r !== undefined) return r
        }
      } else {
        const r = fn(t, depth)
        if (r !== undefined) return r
        if (isOpen) depth++
      }
      if (isSignificant(t)) prev = t
      i = t.end
    }
    return undefined
  }
}

/** 다음 줄이 이 토큰으로 시작하면 앞 줄에 이어진다 */
const CONTINUATION_STARTS = new Set([
  ".", "?.", ",", "&&", "||", "??", "*", "/", "%", "**", "==", "===", "!=", "!==", "<", ">", "<=", ">=",
  "?", ":", "|", "&", "^", "<<", ">>", ">>>", "=", "+=", "-=", "*=", "/=",
])

interface MemeState {
  setPrev(t: Token): void
  endStatementStart(): void
  lastClosed(): string | null
  /** 지금 깊이에서 end까지의 줄바꿈을 문장 시작으로 보지 않는다 */
  guard(end: number): void
  top(): Frame
}

/** 줄 끝 토큰이 연산자·쉼표·여는 괄호면 다음 줄로 문장이 이어진다 (JS ASI와 같은 판단) */
// `:`는 case·default 레이블의 끝이라 다음 줄이 새 문장이다
const STATEMENT_ENDERS = new Set([")", "]", "}", "++", "--", ";", ":"])
function continuesStatement(prev: Token | null): boolean {
  return prev?.type === "punct" && !STATEMENT_ENDERS.has(prev.value)
}

function isBlockBrace(prev: Token | null, prevPrev: Token | null, atStmtStart: boolean, topKind: FrameKind): boolean {
  // export { a }, export default { ... } 는 객체
  if (prev?.type === "ident" && (prev.value === "export" || (prev.value === "default" && prevPrev?.value === "export"))) return false
  // 클래스 static 블록
  if (prev?.type === "ident" && prev.value === "static" && topKind === "class") return true
  if (atStmtStart || !prev) return true
  if (prev.type === "punct") return prev.value === ")" || prev.value === "=>" || prev.value === ";" || prev.value === "}" || prev.value === "{"
  if (prev.type === "ident") return prev.value === "else" || prev.value === "try" || prev.value === "finally" || prev.value === "do"
  return false
}
