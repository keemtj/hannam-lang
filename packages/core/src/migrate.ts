// JS → hannam-lang 역변환. 규칙은 docs/hannam-lang-migrate.md를 따른다.
// acorn으로 위치를 찾고 magic-string으로 키워드 부분만 고친다. 서식은 건드리지 않는다.
// 바꾼 결과를 compile()로 다시 JS로 만들어 원래 AST와 비교하고, 다르면 그 변환만 되돌린다
import { type Comment, type Options, type Token, parse, tokTypes } from "acorn"
import MagicString from "magic-string"
import { compile } from "./compile.js"
import { positionAt } from "./errors.js"

export interface MigrateOptions {
  /** 에러 메시지에 쓸 파일 이름 */
  filename?: string
  /** 줄 맨 앞의 `//` 주석을 `엄...`으로 바꿀지 여부 (기본값 false) */
  comments?: boolean
  /** CommonJS 코드도 변환할지 여부 (기본값 false). `.hn`은 ES 모듈로 실행되므로 보통은 막는다 */
  allowCommonJS?: boolean
  /** 상대 경로 import를 바꿀 때 쓴다. 새 경로를 돌려주면 바꾸고, undefined면 그대로 둔다 */
  rewriteImport?: (specifier: string) => string | undefined
}

export interface MigrateSkip {
  line: number
  /** 0부터 센다 (HannamSyntaxError와 같음) */
  column: number
  kind: string
  reason: string
}

export interface MigrateResult {
  code: string
  /** 실제로 적용한 변환 수 */
  changes: number
  /** 바꿀 수 있어 보였지만 JS 그대로 남긴 곳 */
  skipped: MigrateSkip[]
}

/** 파일 전체를 옮길 수 없을 때 (파싱 실패, CommonJS, 키워드와 겹치는 이름) */
export class MigrateError extends Error {
  readonly line: number | undefined
  readonly column: number | undefined
  readonly filename: string | undefined

  constructor(message: string, filename?: string, pos?: { line: number; column: number }) {
    const where = pos ? `${filename ?? "<입력>"}:${pos.line}:${pos.column + 1}` : filename
    super(where ? `${message} (${where})` : message)
    this.name = "MigrateError"
    this.line = pos?.line
    this.column = pos?.column
    this.filename = filename
  }
}

// acorn 노드. 종류가 많아서 필요한 필드만 그때그때 읽는다
type Node = { type: string; start: number; end: number; [key: string]: any }

interface Edit {
  start: number
  end: number
  text: string
}

interface Unit {
  kind: string
  pos: number
  edits: Edit[]
  /** 컴파일 결과의 모양이 원래 JS와 달라지는 변환(switch, confirm)은 기대 AST를 만들 때 쓴다 */
  switchStart?: number
  confirmStart?: number
}

const PARSE_OPTIONS: Options = { ecmaVersion: "latest", sourceType: "module", allowHashBang: true }
const RUNTIME = "hannam-lang/runtime"

const DECL = { var: "엄", let: "엄.", const: "엄.." } as const

export function migrate(source: string, options: MigrateOptions = {}): MigrateResult {
  const { filename } = options
  const tokens: Token[] = []
  const comments: Comment[] = []
  let ast: Node
  try {
    ast = parse(source, { ...PARSE_OPTIONS, onToken: tokens, onComment: comments }) as unknown as Node
  } catch (e) {
    const err = e as SyntaxError & { loc?: { line: number; column: number } }
    throw new MigrateError(`JS로 읽을 수 없습니다: ${err.message.replace(/ \(\d+:\d+\)$/, "")}`, filename, err.loc)
  }

  const m = new Migrator(source, ast, tokens, comments, options)
  if (!options.allowCommonJS) m.checkCommonJS()

  // 아무것도 바꾸지 않은 상태가 통과해야 한다. 안 되면 원본 JS 자체가 .hn이 될 수 없는 것이다
  const baseline = m.verify([])
  if (baseline !== true) {
    throw new MigrateError(
      `이 JS는 그대로 .hn이 될 수 없습니다. 문장 맨 앞에 키워드와 같은 이름이 있는지 확인하세요: ${baseline}`,
      filename,
    )
  }

  m.collect()
  const accepted = m.settle()
  return { code: m.render(accepted)!, changes: accepted.length, skipped: m.skipped }
}

class Migrator {
  readonly skipped: MigrateSkip[] = []
  private readonly units: Unit[] = []
  /** switch 변환이 가져간 break (따로 줴줴이야로 바꾸지 않는다) */
  private readonly claimed = new Set<number>()
  private readonly shadowed: Set<string>
  /** 컴파일러가 만드는 이름(__hn, __hn_s0 …)과 겹칠 수 있는 이름이 파일에 있는지. 있으면 switch·confirm을 바꾸지 않는다 */
  private readonly usesHnNames: boolean
  private readonly eol: string

  constructor(
    private readonly src: string,
    private readonly ast: Node,
    private readonly tokens: Token[],
    private readonly comments: Comment[],
    private readonly opts: MigrateOptions,
  ) {
    this.shadowed = declaredNames(ast, new Set(["console", "confirm", "window", "require", "module", "exports"]))
    let usesHnNames = false
    walk(ast, (node) => {
      if (node.type === "Identifier" && node.name.startsWith("__hn")) usesHnNames = true
    })
    this.usesHnNames = usesHnNames
    this.eol = src.includes("\r\n") ? "\r\n" : "\n"
  }

  // ── 파일 단위 검사 ──

  checkCommonJS(): void {
    const cjs = new Set(["require", "module", "exports", "__dirname", "__filename"])
    let found: Node | undefined
    walk(this.ast, (node, parent) => {
      if (found || node.type !== "Identifier" || !cjs.has(node.name) || this.shadowed.has(node.name)) return
      if (!isReference(node, parent)) return
      found = node
    })
    if (found) {
      throw new MigrateError(
        `CommonJS(${found.name})를 쓰는 파일은 .hn에서 실행되지 않습니다. import/export로 바꾼 뒤 옮기세요`,
        this.opts.filename,
        positionAt(this.src, found.start),
      )
    }
  }

  // ── 변환 후보 모으기 ──

  collect(): void {
    walk(this.ast, (node, parent) => {
      switch (node.type) {
        case "VariableDeclaration":
          return this.variable(node, parent)
        case "IfStatement":
          if (parent?.type === "IfStatement" && parent.alternate === node) return
          return this.ifChain(node)
        case "WhileStatement":
          return this.whileLoop(node)
        case "ForOfStatement":
        case "ForInStatement":
          return this.forEach(node)
        case "ForStatement":
          return this.forRange(node)
        case "SwitchStatement":
          return this.switchStatement(node)
        case "BreakStatement":
        case "ContinueStatement":
          return this.jump(node)
        case "ReturnStatement":
          return this.keyword(node, "return", "아! 줴줴이야~", "return")
        case "ThrowStatement":
          return this.throwStatement(node)
        case "FunctionDeclaration":
          return this.functionDeclaration(node)
        case "AwaitExpression":
          return this.add("await", node.start, [{ start: node.start, end: node.start + 5, text: "티~원!" }])
        case "ClassDeclaration":
          return this.classDeclaration(node)
        case "TryStatement":
          return this.tryStatement(node)
        case "ExpressionStatement":
          return this.consoleLog(node)
        case "CallExpression":
          return this.confirm(node)
        case "ImportDeclaration":
        case "ExportNamedDeclaration":
        case "ExportAllDeclaration":
        case "ImportExpression":
          return this.importPath(node)
      }
    })
    if (this.opts.comments) this.lineComments()
    this.units.sort((a, b) => a.pos - b.pos)
  }

  private variable(node: Node, parent: Node | undefined): void {
    const kind = node.kind as string
    if (!(kind in DECL)) return
    if (!parent || !["Program", "BlockStatement", "StaticBlock", "SwitchCase", "ExportNamedDeclaration"].includes(parent.type)) return
    if (!/^[ \t]/.test(this.src.slice(node.start + kind.length))) return
    if (!this.atStatementStart(node.start)) return
    this.add("variable", node.start, [{ start: node.start, end: node.start + kind.length, text: DECL[kind as keyof typeof DECL] }])
  }

  private ifChain(node: Node): void {
    if (node.consequent.type !== "BlockStatement") return this.skip(node, "if", "본문이 블록({ })이 아닙니다")
    if (!this.atStatementStart(node.start)) return this.skip(node, "if", "문장 맨 앞이 아닙니다")
    const edits = this.header(node.start, node.start + 2, node.test, node.consequent.start, "예?")
    let prev = node
    let alt: Node | null = node.alternate
    while (alt) {
      const elseTok = this.findToken(prev.consequent.end, alt.start, (t) => t.type === tokTypes._else)
      if (!elseTok) break
      if (alt.type === "IfStatement") {
        if (alt.consequent.type !== "BlockStatement") break
        // `else if`를 통째로 `예??`로 바꾼다
        const ifTok = this.findToken(elseTok.end, alt.test.start, (t) => t.type === tokTypes._if)
        if (!ifTok) break
        edits.push(...this.header(elseTok.start, ifTok.end, alt.test, alt.consequent.start, "예??"))
        prev = alt
        alt = alt.alternate
      } else {
        if (alt.type === "BlockStatement") edits.push({ start: elseTok.start, end: elseTok.end, text: "아뇨아뇨아뇨아뇨" })
        break
      }
    }
    this.add("if", node.start, edits)
  }

  private whileLoop(node: Node): void {
    if (node.body.type !== "BlockStatement") return this.skip(node, "while", "본문이 블록({ })이 아닙니다")
    if (!this.atStatementStart(node.start)) return this.skip(node, "while", "문장 맨 앞이 아닙니다")
    this.add("while", node.start, this.header(node.start, node.start + 5, node.test, node.body.start, "요이이이~"))
  }

  private forEach(node: Node): void {
    const kind = node.type === "ForOfStatement" ? "for...of" : "for...in"
    if (node.await) return
    const left = node.left
    if (node.body.type !== "BlockStatement") return this.skip(node, kind, "본문이 블록({ })이 아닙니다")
    if (left.type !== "VariableDeclaration" || left.kind !== "const" || left.declarations.length !== 1) {
      return this.skip(node, kind, "const로 선언한 반복 변수만 바꿉니다 (요이~/요히~는 const로 컴파일됨)")
    }
    if (!this.atStatementStart(node.start)) return this.skip(node, kind, "문장 맨 앞이 아닙니다")
    const id = left.declarations[0].id
    const right = node.right
    if (this.src.slice(right.start, right.end).includes("{")) return this.skip(node, kind, "반복 대상에 {가 있습니다")
    const close = this.findTokenBack(right.end, node.body.start, (t) => t.type === tokTypes.parenR)
    if (!close) return
    this.add(kind, node.start, [
      { start: node.start, end: id.start, text: node.type === "ForOfStatement" ? "요이~ " : "요히~ " },
      { start: id.end, end: right.start, text: " " },
      { start: close.start, end: close.end, text: "" },
    ])
  }

  private forRange(node: Node): void {
    const { init, test, update, body } = node
    const isRange =
      init?.type === "VariableDeclaration" &&
      init.kind === "let" &&
      init.declarations.length === 1 &&
      init.declarations[0].id.type === "Identifier" &&
      init.declarations[0].init &&
      test?.type === "BinaryExpression" &&
      test.operator === "<" &&
      test.left.type === "Identifier" &&
      update?.type === "UpdateExpression" &&
      update.operator === "++" &&
      !update.prefix &&
      update.argument.type === "Identifier"
    if (!isRange) return
    const name = init.declarations[0].id.name as string
    if (test.left.name !== name || update.argument.name !== name) return
    if (body.type !== "BlockStatement") return this.skip(node, "for", "본문이 블록({ })이 아닙니다")
    if (!this.atStatementStart(node.start)) return this.skip(node, "for", "문장 맨 앞이 아닙니다")
    const from = this.text(init.declarations[0].init)
    const to = this.text(test.right)
    if (/\.\.|[{\n]/.test(from + to)) return this.skip(node, "for", "범위 식에 .. 이나 { 또는 줄바꿈이 있습니다")
    this.add("for", node.start, [{ start: node.start, end: body.start, text: `요이~ ${name} ${from}..${to} ` }])
  }

  private switchStatement(node: Node): void {
    const fail = (reason: string) => this.skip(node, "switch", reason)
    if (!this.atStatementStart(node.start)) return fail("문장 맨 앞이 아닙니다")
    const cases: Node[] = node.cases
    if (cases.length === 0) return fail("case가 없습니다")
    const defaultIndex = cases.findIndex((c) => c.test === null)
    if (defaultIndex !== -1 && defaultIndex !== cases.length - 1) return fail("default가 마지막이 아닙니다")

    // 빈 case는 다음 case와 묶는다 (`case "a": case "b":` → `"a", "b" {`)
    const groups: Node[][] = []
    let pending: Node[] = []
    for (const c of cases) {
      pending.push(c)
      if (c.consequent.length > 0) {
        groups.push(pending)
        pending = []
      }
    }
    if (pending.length > 0) return fail("마지막 case에 내용이 없습니다")
    if (groups.some((g) => g.length > 1 && g.some((c) => c.test === null))) return fail("default와 묶인 case가 있습니다")

    const declared = new Map<string, number>()
    for (const [gi, g] of groups.entries()) {
      const body: Node[] = g[g.length - 1]!.consequent
      if (body.length === 1 && body[0]!.type === "BlockStatement") return fail("블록으로 감싼 case는 아직 바꾸지 않습니다")
      for (const stmt of body) {
        for (const name of lexicalNames(stmt)) declared.set(name, gi)
      }
    }
    // 각 case가 블록이 되므로, 한 case에서 선언한 이름을 다른 case에서 쓰면 안 된다
    for (const [gi, g] of groups.entries()) {
      const body: Node[] = g[g.length - 1]!.consequent
      for (const stmt of body) {
        let clash = false
        walk(stmt, (n) => {
          if (n.type === "Identifier" && declared.has(n.name) && declared.get(n.name) !== gi) clash = true
        })
        if (clash) return fail("한 case에서 선언한 이름을 다른 case에서 씁니다")
      }
    }
    // case 조건은 switch 블록 안에서 평가되어 case에서 선언한 이름(TDZ, 끌어올린 function)을 본다.
    // .hn에서는 조건이 블록 밖 if 조건이 되므로, 그런 이름을 쓰는 조건이 있으면 바꾸지 않는다
    for (const c of cases) {
      if (!c.test) continue
      let uses = false
      walk(c.test, (n) => {
        if (n.type === "Identifier" && declared.has(n.name)) uses = true
      })
      if (uses) return fail("case 조건이 case 안에서 선언한 이름을 씁니다")
    }
    if (this.usesHnNames) return fail("__hn으로 시작하는 이름이 있어 컴파일러의 임시 이름과 겹칠 수 있습니다")

    const edits = this.header(node.start, node.start + 6, node.discriminant, this.findToken(node.discriminant.end, node.end, (t) => t.type === tokTypes.braceL)!.start, "예???")
    const claimed: number[] = []
    for (const [gi, g] of groups.entries()) {
      const last = gi === groups.length - 1
      const body: Node[] = g[g.length - 1]!.consequent
      const tail = body[body.length - 1]!
      const endsWithBreak = tail.type === "BreakStatement" && !tail.label
      // return·throw·continue·레이블 break로 끝나면 다음 case로 넘어가지 않으므로 그대로 블록이 된다
      const endsWithExit = /^(Return|Throw|Continue)Statement$/.test(tail.type) || (tail.type === "BreakStatement" && tail.label)
      if (!endsWithBreak && !endsWithExit && !last) return fail("break 없이 다음 case로 넘어갑니다 (fallthrough)")
      for (const stmt of endsWithBreak ? body.slice(0, -1) : body) {
        if (breaksOutOf(stmt)) return fail("case 중간에 switch를 빠져나가는 break가 있습니다")
      }
      for (const [ci, c] of g.entries()) {
        const colon = this.findToken(c.test ? c.test.end : c.start, c.end, (t) => t.type === tokTypes.colon)
        if (!colon) return fail("case의 : 위치를 찾지 못했습니다")
        const head = c.test ? this.text(c.test) + (ci === g.length - 1 ? " {" : ",") : "아뇨아뇨아뇨아뇨 {"
        edits.push({ start: c.start, end: colon.end, text: head })
      }
      const indent = this.indentOf(g[0]!.start)
      if (endsWithBreak) {
        claimed.push(tail.start)
        const lineStart = this.lineStart(tail.start)
        const ownLine = indent !== undefined && /^[ \t]*$/.test(this.src.slice(lineStart, tail.start))
        edits.push(ownLine ? { start: lineStart, end: tail.end, text: `${indent}}` } : { start: tail.start, end: tail.end, text: "}" })
      } else {
        edits.push({ start: tail.end, end: tail.end, text: indent !== undefined ? `${this.eol}${indent}}` : " }" })
      }
    }
    for (const b of claimed) this.claimed.add(b)
    this.add("switch", node.start, edits, node.start)
  }

  private jump(node: Node): void {
    if (node.label || this.claimed.has(node.start)) return
    const isBreak = node.type === "BreakStatement"
    this.keyword(node, isBreak ? "break" : "continue", isBreak ? "줴줴이야" : "아뇨", isBreak ? "break" : "continue")
  }

  private throwStatement(node: Node): void {
    if (node.argument.type !== "NewExpression") {
      return this.skip(node, "throw", "new로 만든 값만 바꿉니다 (그 밖의 값은 .hn에서 Error로 감싸져 동작이 달라짐)")
    }
    this.keyword(node, "throw", "아... 줴줴이야...", "throw")
  }

  private functionDeclaration(node: Node): void {
    if (node.generator || !node.id) return
    if (!this.atStatementStart(node.start)) return this.skip(node, "function", "문장 맨 앞이 아닙니다")
    this.add("function", node.start, [{ start: node.start, end: node.id.start, text: node.async ? "티~원 " : "티-원 " }])
  }

  private classDeclaration(node: Node): void {
    if (!node.id) return
    if (!this.atStatementStart(node.start)) return this.skip(node, "class", "문장 맨 앞이 아닙니다")
    if (!node.superClass) {
      this.add("class", node.start, [{ start: node.start, end: node.id.start, text: "오호호호호~ " }])
      return
    }
    if (this.text(node.superClass).includes("{")) return this.skip(node, "class", "부모 클래스 식에 {가 있습니다")
    this.add("class", node.start, [
      { start: node.start, end: node.id.start, text: "오호호호홋~ " },
      { start: node.id.end, end: node.superClass.start, text: " " },
    ])
  }

  private tryStatement(node: Node): void {
    if (!this.atStatementStart(node.start)) return this.skip(node, "try", "문장 맨 앞이 아닙니다")
    const edits: Edit[] = [{ start: node.start, end: node.start + 3, text: "진~지?" }]
    const handler = node.handler
    if (handler) {
      const param = handler.param
      edits.push({
        start: handler.start,
        end: handler.body.start,
        text: param ? `지~랄 ${this.text(param)} ` : "지~랄 ",
      })
    }
    this.add("try", node.start, edits)
  }

  private consoleLog(node: Node): void {
    const call = node.expression
    if (call.type !== "CallExpression" || call.optional) return
    const callee = call.callee
    if (
      callee.type !== "MemberExpression" ||
      callee.computed ||
      callee.optional ||
      callee.object.type !== "Identifier" ||
      callee.object.name !== "console" ||
      callee.property.name !== "log"
    ) {
      return
    }
    if (this.shadowed.has("console")) return this.skip(node, "console.log", "console이 지역 변수로 가려져 있습니다")
    if (!this.atStatementStart(node.start)) return this.skip(node, "console.log", "문장 맨 앞이 아닙니다")
    const args: Node[] = call.arguments
    if (args.length === 0) {
      this.add("console.log", node.start, [{ start: call.start, end: call.end, text: "무슨 발언이세요?" }])
      return
    }
    if (this.src.slice(call.start, call.end).includes("\n")) {
      return this.skip(node, "console.log", "여러 줄에 걸친 console.log는 아직 바꾸지 않습니다")
    }
    if (/,\s*$/.test(this.src.slice(args[args.length - 1]!.end, call.end - 1))) {
      return this.skip(node, "console.log", "인자 끝에 쉼표가 있습니다")
    }
    this.add("console.log", node.start, [
      { start: call.start, end: args[0]!.start, text: "무슨 발언이세요? " },
      { start: args[args.length - 1]!.end, end: call.end, text: "" },
    ])
  }

  private confirm(node: Node): void {
    const callee = node.callee
    if (node.optional) return
    const isGlobal = callee.type === "Identifier" && callee.name === "confirm" && !this.shadowed.has("confirm")
    const isWindow =
      callee.type === "MemberExpression" &&
      !callee.computed &&
      !callee.optional &&
      callee.object.type === "Identifier" &&
      callee.object.name === "window" &&
      !this.shadowed.has("window") &&
      callee.property.name === "confirm"
    if (!isGlobal && !isWindow) return
    // 인자 없는 confirm()은 빈 확인 창이지만, 런타임 헬퍼는 String(undefined)를 띄운다
    if (node.arguments.length === 0) return this.skip(node, "confirm", "인자 없는 confirm()은 바꾸지 않습니다")
    if (this.usesHnNames) return this.skip(node, "confirm", "__hn으로 시작하는 이름이 있어 런타임 헬퍼와 겹칠 수 있습니다")
    this.units.push({
      kind: "confirm",
      pos: node.start,
      edits: [{ start: callee.start, end: callee.end, text: "예? 무슨 발언이세요?" }],
      confirmStart: node.start,
    })
  }

  private importPath(node: Node): void {
    const rewrite = this.opts.rewriteImport
    const source = node.source
    if (!rewrite || source?.type !== "Literal" || typeof source.value !== "string") return
    const next = rewrite(source.value)
    if (next === undefined || next === source.value) return
    const quote = this.src[source.start]
    this.add("import", source.start, [{ start: source.start, end: source.end, text: `${quote}${next}${quote}` }])
  }

  private lineComments(): void {
    for (const c of this.comments) {
      if (c.type !== "Line") continue
      // acorn은 파일 맨 앞의 #!도 줄 주석으로 넘긴다
      if (c.start === 0 && this.src.startsWith("#!")) continue
      if (!/^[ \t]*$/.test(this.src.slice(this.lineStart(c.start), c.start))) continue
      // 도구가 읽는 주석은 그대로 둔다 (///, //#, //@, eslint, prettier 등)
      if (/^(\/|#|@|\s*(eslint|prettier|biome-|istanbul|c8|jshint|global\b|ts-))/.test(c.value)) continue
      const text = c.value.replace(/^ /, "")
      this.add("comment", c.start, [{ start: c.start, end: c.end, text: text ? `엄... ${text}` : "엄..." }])
    }
  }

  // ── 검증 ──

  /** 변환을 적용한 결과가 원래 JS와 같은 의미인지 본다. 같으면 true, 아니면 이유 */
  verify(units: Unit[]): true | string {
    const code = this.render(units)
    if (code === undefined) return "변환끼리 겹칩니다"
    let compiled: string
    try {
      compiled = compile(code, { filename: this.opts.filename, rewriteImports: true }).code
    } catch (e) {
      return (e as Error).message.split("\n")[0] ?? "컴파일 실패"
    }
    let out: Node
    try {
      out = parse(compiled, PARSE_OPTIONS) as unknown as Node
    } catch (e) {
      return `컴파일 결과가 올바른 JS가 아닙니다: ${(e as Error).message}`
    }
    const expected = {
      switches: new Set(units.flatMap((u) => (u.switchStart === undefined ? [] : [u.switchStart]))),
      confirms: new Set(units.flatMap((u) => (u.confirmStart === undefined ? [] : [u.confirmStart]))),
    }
    // __hn 계열 이름이 원래 코드에 있으면 switch를 바꾸지 않으므로, 컴파일 결과의 그 이름은 사용자 것이라 그대로 비교한다
    const output = { renameTemps: !this.usesHnNames }
    return canonical(this.ast, expected, null) === canonical(out, null, output) || "변환 결과의 의미가 원래 JS와 다릅니다"
  }

  /** 모든 변환을 한꺼번에 검증하고, 실패하면 반으로 나눠 가며 문제가 되는 변환만 뺀다 */
  settle(): Unit[] {
    const accepted: Unit[] = []
    const tryAdd = (list: Unit[]): void => {
      if (list.length === 0) return
      const result = this.verify([...accepted, ...list])
      if (result === true) {
        accepted.push(...list)
        return
      }
      if (list.length === 1) {
        this.skip({ start: list[0]!.pos } as Node, list[0]!.kind, `검증에서 걸러졌습니다: ${result}`)
        return
      }
      const mid = Math.floor(list.length / 2)
      tryAdd(list.slice(0, mid))
      tryAdd(list.slice(mid))
    }
    tryAdd(this.units)
    accepted.sort((a, b) => a.pos - b.pos)
    this.skipped.sort((a, b) => a.line - b.line || a.column - b.column)
    return accepted
  }

  /** 변환을 적용한 코드. 변환끼리 겹치면 undefined */
  render(units: Unit[]): string | undefined {
    const edits = units.flatMap((u) => u.edits).sort((a, b) => a.start - b.start || a.end - b.end)
    const s = new MagicString(this.src)
    let lastEnd = -1
    for (const e of edits) {
      if (e.start < lastEnd) return undefined
      if (e.start === e.end) s.appendLeft(e.start, e.text)
      else if (e.text === "") s.remove(e.start, e.end)
      else s.overwrite(e.start, e.end, e.text)
      lastEnd = Math.max(lastEnd, e.end)
    }
    return s.toString()
  }

  // ── 도우미 ──

  private add(kind: string, pos: number, edits: Edit[], switchStart?: number): void {
    this.units.push({ kind, pos, edits, switchStart })
  }

  private skip(node: { start: number }, kind: string, reason: string): void {
    const { line, column } = positionAt(this.src, node.start)
    this.skipped.push({ line, column, kind, reason })
  }

  /** 문장 키워드 하나를 바꾼다 (return, throw, break, continue) */
  private keyword(node: Node, kind: string, text: string, js: string): void {
    if (this.src.slice(node.start, node.start + js.length) !== js) return
    if (!this.atStatementStart(node.start)) return this.skip(node, kind, "문장 맨 앞이 아닙니다")
    this.add(kind, node.start, [{ start: node.start, end: node.start + js.length, text }])
  }

  /** `if (조건) {` 같은 헤더를 `예? 조건 {`로. 바깥 괄호 한 쌍만 벗기고, 조건에 {가 있으면 괄호를 남긴다 */
  private header(kwStart: number, kwEnd: number, test: Node, bodyStart: number, text: string): Edit[] {
    const keyword = { start: kwStart, end: kwEnd, text }
    if (this.keepParens(test)) return [keyword]
    const open = this.findToken(kwEnd, test.start, (t) => t.type === tokTypes.parenL)
    const close = this.findTokenBack(test.end, bodyStart, (t) => t.type === tokTypes.parenR)
    if (!open || !close) return [keyword]
    const inner = open.end + (/^[ \t]*/.exec(this.src.slice(open.end))?.[0].length ?? 0)
    return [
      { start: kwStart, end: inner, text: `${text} ` },
      { start: close.start, end: close.end, text: "" },
    ]
  }

  private keepParens(test: Node): boolean {
    return this.text(test).includes("{")
  }

  private text(node: Node): string {
    return this.src.slice(node.start, node.end)
  }

  /** 문장 시작 위치인지: 줄 맨 앞, {·}·; 뒤, export(default) 뒤 */
  private atStatementStart(pos: number): boolean {
    const i = this.tokenIndexBefore(pos)
    if (i < 0) return true
    const prev = this.tokens[i]!
    if (/[\n\r\u2028\u2029]/.test(this.src.slice(prev.end, pos))) return true
    if (prev.type === tokTypes.braceL || prev.type === tokTypes.braceR || prev.type === tokTypes.semi) return true
    if (prev.type === tokTypes._export) return true
    return prev.type === tokTypes._default && this.tokens[i - 1]?.type === tokTypes._export
  }

  /** pos 이전에 끝나는 마지막 토큰의 번호 */
  private tokenIndexBefore(pos: number): number {
    let lo = 0
    let hi = this.tokens.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (this.tokens[mid]!.end <= pos) {
        found = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return found
  }

  private findToken(from: number, to: number, pred: (t: Token) => boolean): Token | undefined {
    for (let i = this.tokenIndexBefore(from) + 1; i < this.tokens.length; i++) {
      const t = this.tokens[i]!
      if (t.start >= to) return undefined
      if (t.start >= from && pred(t)) return t
    }
    return undefined
  }

  private findTokenBack(from: number, to: number, pred: (t: Token) => boolean): Token | undefined {
    for (let i = this.tokenIndexBefore(to); i >= 0; i--) {
      const t = this.tokens[i]!
      if (t.start < from) return undefined
      if (pred(t)) return t
    }
    return undefined
  }

  private lineStart(pos: number): number {
    return this.src.lastIndexOf("\n", pos - 1) + 1
  }

  /** pos가 그 줄의 첫 글자일 때 앞의 들여쓰기. 아니면 undefined */
  private indentOf(pos: number): string | undefined {
    const before = this.src.slice(this.lineStart(pos), pos)
    return /^[ \t]*$/.test(before) ? before : undefined
  }
}

// ── AST 도우미 ──

function walk(node: Node, visit: (node: Node, parent: Node | undefined) => void, parent?: Node): void {
  visit(node, parent)
  for (const key in node) {
    if (key === "type" || key === "start" || key === "end") continue
    const value = node[key]
    if (Array.isArray(value)) {
      for (const child of value) if (child && typeof child.type === "string") walk(child, visit, node)
    } else if (value && typeof value.type === "string") {
      walk(value, visit, node)
    }
  }
}

/** 이 이름들 중 파일 어딘가에서 선언(변수, 인자, 함수, 클래스, import, catch)된 것 */
function declaredNames(ast: Node, watch: Set<string>): Set<string> {
  const found = new Set<string>()
  const add = (pattern: Node | null | undefined) => {
    for (const name of patternNames(pattern)) if (watch.has(name)) found.add(name)
  }
  walk(ast, (node) => {
    switch (node.type) {
      case "VariableDeclarator":
        return add(node.id)
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        add(node.id)
        for (const p of node.params) add(p)
        return
      case "ClassDeclaration":
      case "ClassExpression":
        return add(node.id)
      case "ImportSpecifier":
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
        return add(node.local)
      case "CatchClause":
        return add(node.param)
    }
  })
  return found
}

function patternNames(p: Node | null | undefined): string[] {
  if (!p) return []
  switch (p.type) {
    case "Identifier":
      return [p.name]
    case "ObjectPattern":
      return p.properties.flatMap((q: Node) => patternNames(q.type === "RestElement" ? q.argument : q.value))
    case "ArrayPattern":
      return p.elements.flatMap((q: Node | null) => patternNames(q))
    case "AssignmentPattern":
      return patternNames(p.left)
    case "RestElement":
      return patternNames(p.argument)
    default:
      return []
  }
}

/** case 본문의 문장이 그 블록에 만드는 이름 (let, const, class, function) */
function lexicalNames(stmt: Node): string[] {
  if (stmt.type === "VariableDeclaration" && stmt.kind !== "var") {
    return stmt.declarations.flatMap((d: Node) => patternNames(d.id))
  }
  if ((stmt.type === "ClassDeclaration" || stmt.type === "FunctionDeclaration") && stmt.id) return [stmt.id.name]
  return []
}

/** 레이블 없는 break가 이 switch를 빠져나가는지 (반복문, 다른 switch, 함수 안은 제외) */
function breaksOutOf(stmt: Node): boolean {
  let found = false
  const visit = (node: Node): void => {
    if (found) return
    if (node.type === "BreakStatement" && !node.label) {
      found = true
      return
    }
    if (
      /^(For|ForIn|ForOf|While|DoWhile|Switch)Statement$/.test(node.type) ||
      /Function/.test(node.type) ||
      node.type === "ClassBody"
    ) {
      return
    }
    for (const key in node) {
      if (key === "type" || key === "start" || key === "end") continue
      const value = node[key]
      if (Array.isArray(value)) for (const c of value) c && typeof c.type === "string" && visit(c)
      else if (value && typeof value.type === "string") visit(value)
    }
  }
  visit(stmt)
  return found
}

/** 식별자 노드가 값을 읽는 자리인지 (속성 이름, 선언 자리 제외) */
function isReference(node: Node, parent: Node | undefined): boolean {
  if (!parent) return true
  if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return false
  if ((parent.type === "Property" || parent.type === "MethodDefinition" || parent.type === "PropertyDefinition") && parent.key === node && !parent.computed) {
    return parent.type === "Property" && parent.shorthand
  }
  if (parent.type === "VariableDeclarator" && parent.id === node) return false
  if (/Function|Class/.test(parent.type) && parent.id === node) return false
  if (parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement") return false
  if (parent.type === "ExportSpecifier" || parent.type === "ImportSpecifier") return false
  return true
}

const CONFIRM: Node = {
  type: "MemberExpression",
  start: 0,
  end: 0,
  object: { type: "Identifier", start: 0, end: 0, name: "__hn" },
  property: { type: "Identifier", start: 0, end: 0, name: "confirm" },
  computed: false,
  optional: false,
}

/**
 * 비교용 정규형. 위치·주석·raw를 빼고 키를 정렬해 문자열로 만든다.
 * - 원래 JS 쪽: 바꾼 switch는 .hn이 컴파일되는 모양(if-else)으로, 바꾼 confirm 호출은 __hn.confirm으로 바꿔 놓는다
 * - 양쪽 모두: 런타임 import(hannam-lang/runtime)를 뺀다
 * - 컴파일 결과 쪽: `__hn_s0` 같은 switch 임시 변수 이름의 번호를 없앤다
 *   (__hn으로 시작하는 이름이 원래 코드에 있으면 switch·confirm을 바꾸지 않고, 이름도 바꾸지 않는다)
 */
function canonical(
  ast: Node,
  expected: { switches: Set<number>; confirms: Set<number> } | null,
  compiled: { renameTemps: boolean } | null,
): string {
  const norm = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(norm)
    // acorn은 BigInt 리터럴의 값을 bigint로 넣는데, JSON.stringify가 다루지 못한다
    if (typeof value === "bigint") return `${value}n`
    if (!value || typeof value !== "object") return value
    let node = value as Node
    if (expected && node.type === "SwitchStatement" && expected.switches.has(node.start)) node = desugarSwitch(node)
    if (expected && node.type === "CallExpression" && expected.confirms.has(node.start)) node = { ...node, callee: CONFIRM }
    if (compiled?.renameTemps && node.type === "Identifier" && /^__hn_s\d+$/.test(node.name)) node = { ...node, name: "__hn_s" }
    // 런타임 import는 양쪽에서 뺀다 (이미 컴파일된 JS를 옮길 때 원래 코드에도 들어 있다)
    if (node.type === "Program") {
      node = { ...node, body: node.body.filter((s: Node) => !(s.type === "ImportDeclaration" && s.source.value === RUNTIME)) }
    }
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(node).sort()) {
      if (key === "start" || key === "end" || key === "raw" || key === "loc" || key === "range") continue
      out[key] = norm(node[key])
    }
    return out
  }
  return JSON.stringify(norm(ast))
}

/** switch를 .hn의 예???가 컴파일되는 모양으로: `{ const __hn_s = 값; if (__hn_s === a || …) {…} else {…} }` */
function desugarSwitch(node: Node): Node {
  const n = (type: string, fields: Record<string, unknown>): Node => ({ type, start: 0, end: 0, ...fields })
  const id = () => n("Identifier", { name: "__hn_s" })
  const groups: { tests: Node[]; body: Node[] }[] = []
  let tests: Node[] = []
  let defaultBody: Node[] | undefined
  for (const c of node.cases as Node[]) {
    const body = c.consequent.length > 0 && c.consequent[c.consequent.length - 1].type === "BreakStatement" && !c.consequent[c.consequent.length - 1].label ? c.consequent.slice(0, -1) : c.consequent
    if (c.test === null) {
      defaultBody = body
      continue
    }
    tests.push(c.test)
    if (c.consequent.length > 0) {
      groups.push({ tests, body })
      tests = []
    }
  }
  let chain: Node | null = defaultBody ? n("BlockStatement", { body: defaultBody }) : null
  for (const g of groups.reverse()) {
    const test = g.tests
      .map((t) => n("BinaryExpression", { operator: "===", left: id(), right: t }))
      .reduce((a, b) => n("LogicalExpression", { operator: "||", left: a, right: b }))
    chain = n("IfStatement", { test, consequent: n("BlockStatement", { body: g.body }), alternate: chain })
  }
  const decl = n("VariableDeclaration", {
    kind: "const",
    declarations: [n("VariableDeclarator", { id: id(), init: node.discriminant })],
  })
  return n("BlockStatement", { body: chain ? [decl, chain] : [decl] })
}
