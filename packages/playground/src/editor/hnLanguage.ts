import { javascript } from "@codemirror/lang-javascript"
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language"
import { RangeSetBuilder, type Extension } from "@codemirror/state"
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"

// .hn 문법 키워드. 가장 긴 형태가 먼저 맞도록 길이 순으로 둔다 (명세의 "가장 긴 형태 우선")
export const HN_KEYWORDS = [
  "예? 무슨 발언이세요?",
  "아... 줴줴이야...",
  "아! 줴줴이야~",
  "무슨 발언이세요?",
  "아뇨아뇨아뇨아뇨",
  "오호호호호~",
  "오호호호홋~",
  "요이이이~",
  "줴줴이야",
  "진~지?",
  "지~랄",
  "티~원!",
  "티~원",
  "티-원",
  "요이~",
  "요히~",
  "예???",
  "예??",
  "예?",
  "엄..",
  "엄.",
  "아뇨",
].sort((a, b) => b.length - a.length)

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// `엄` 계열은 뒤에 공백이 와야 키워드 (`엄.length`는 멤버 접근). `엄...`은 줄 주석
const KEYWORD_RE = new RegExp(
  `(?<![\\p{ID_Continue}$])(?:(엄\\.\\.\\.[^\\n]*)|(?:${HN_KEYWORDS.map(escape).join("|")}|엄(?=\\s)))`,
  "gu",
)

const keywordMark = Decoration.mark({ class: "cm-hn-keyword" })
const commentMark = Decoration.mark({ class: "cm-hn-comment" })

// JS 파서가 문자열·주석·정규식으로 본 자리는 건드리지 않는다
const LITERAL_NODES = new Set(["String", "TemplateString", "LineComment", "BlockComment", "RegExp"])

function insideLiteral(view: EditorView, pos: number): boolean {
  const node = syntaxTree(view.state).resolveInner(pos, 1)
  for (let n: typeof node | null = node; n; n = n.parent) {
    if (LITERAL_NODES.has(n.name)) return true
  }
  return false
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    KEYWORD_RE.lastIndex = 0
    for (let m = KEYWORD_RE.exec(text); m; m = KEYWORD_RE.exec(text)) {
      const start = from + m.index
      if (insideLiteral(view, start)) continue
      builder.add(start, start + m[0].length, m[1] ? commentMark : keywordMark)
    }
  }
  return builder.finish()
}

const hnKeywordPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

// 색은 CSS 변수로 지정해서 라이트·다크 테마를 CSS만으로 바꾼다 (styles.ts 참고)
const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: "var(--hnpg-syn-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--hnpg-syn-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--hnpg-syn-number)" },
  { tag: [t.lineComment, t.blockComment], color: "var(--hnpg-syn-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--hnpg-syn-function)" },
  { tag: [t.className, t.typeName], color: "var(--hnpg-syn-class)" },
  { tag: t.propertyName, color: "var(--hnpg-syn-property)" },
  { tag: t.invalid, color: "inherit" },
])

/** JS 편집기 공통 확장: JS 문법 + CSS 변수 색 */
export function jsHighlighting(): Extension {
  return [javascript(), syntaxHighlighting(highlightStyle)]
}

/** .hn 편집기: JS 하이라이팅 위에 밈 키워드 강조를 얹는다 */
export function hnLanguage(): Extension {
  return [jsHighlighting(), hnKeywordPlugin]
}

/** 에디터 바탕·커서·선택 영역 색도 CSS 변수로 */
export const editorTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "var(--hnpg-editor-bg)", color: "var(--hnpg-fg)" },
  ".cm-scroller": { fontFamily: "var(--hnpg-mono)", lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--hnpg-fg)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--hnpg-fg)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--hnpg-selection) !important",
  },
  ".cm-gutters": {
    backgroundColor: "var(--hnpg-editor-bg)",
    color: "var(--hnpg-muted)",
    border: "none",
  },
  ".cm-activeLine": { backgroundColor: "var(--hnpg-active-line)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--hnpg-active-line)" },
  // JS 파서가 밈 키워드 일부를 다른 토큰으로 보고 색을 입히므로, 안쪽 요소까지 덮어쓴다
  ".cm-hn-keyword, .cm-hn-keyword *": { color: "var(--hnpg-syn-hn) !important", fontWeight: "600" },
  ".cm-hn-comment, .cm-hn-comment *": {
    color: "var(--hnpg-syn-comment) !important",
    fontStyle: "italic",
    fontWeight: "normal",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--hnpg-panel-bg)",
    color: "var(--hnpg-fg)",
    border: "1px solid var(--hnpg-border)",
  },
  ".cm-diagnostic-error": { borderLeftColor: "var(--hnpg-error)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--hnpg-error)",
    textUnderlineOffset: "3px",
  },
})
