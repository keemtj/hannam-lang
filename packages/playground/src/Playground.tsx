import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { indentOnInput, bracketMatching } from "@codemirror/language"
import { setDiagnostics } from "@codemirror/lint"
import { EditorState } from "@codemirror/state"
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view"
import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState, type CSSProperties } from "react"
import { compileSource, type CompileOutcome } from "./compileSource"
import { editorTheme, hnLanguage, jsHighlighting } from "./editor/hnLanguage"
import { DEFAULT_CODE, EXAMPLES } from "./examples"
import { importJs, importNotice } from "./importJs"
import { initialRunState, runReducer, type RunStatus } from "./sandbox/consoleLog"
import { startRun, type RunHandle } from "./sandbox/runner"
import { decodeHash, encodeHash } from "./share"
import { PLAYGROUND_CSS } from "./styles"

export type PlaygroundTheme = "light" | "dark" | "system"

export interface PlaygroundProps {
  /** 처음 보여 줄 .hn 코드. 없으면 첫 번째 예제 */
  initialCode?: string
  /** 전체 높이 (숫자는 px). 기본 560 */
  height?: number | string
  /** 테마. 기본 "system"(운영체제 설정을 따름). 툴바 버튼으로 바꿀 수 있다 */
  theme?: PlaygroundTheme
  /** true면 코드를 URL 해시에 저장하고, 해시에 코드가 있으면 그 코드로 시작한다 (/playground 페이지용) */
  syncUrl?: boolean
  /** 공유 링크의 기준 주소. 없으면 현재 페이지 주소 (문서 안 블록에서 /playground로 보낼 때 지정) */
  shareBaseUrl?: string
  /** 예제 선택 상자를 보일지 여부. 기본 true */
  showExamples?: boolean
  /** 반복문 하나가 멈추지 않고 돌 수 있는 시간(ms). 기본 3000 */
  loopLimitMs?: number
}

const STATUS_LABEL: Record<RunStatus, string> = {
  idle: "",
  running: "실행 중…",
  done: "실행 완료",
  stopped: "정지됨",
  timeout: "시간 제한으로 멈춤",
}

export function Playground({
  initialCode,
  height = 560,
  theme = "system",
  syncUrl = false,
  shareBaseUrl,
  showExamples = true,
  loopLimitMs = 3000,
}: PlaygroundProps) {
  const [startCode] = useState(initialCode ?? DEFAULT_CODE)
  const [code, setCode] = useState(startCode)
  const outcome = useMemo(() => compileSource(code), [code])
  // 에러가 나는 동안에는 마지막으로 성공한 JS를 흐리게 보여 준다
  const lastGoodJs = useRef(outcome.ok ? outcome.code : "")
  if (outcome.ok) lastGoodJs.current = outcome.code

  const [run, dispatch] = useReducer(runReducer, initialRunState)
  const [themeChoice, setThemeChoice] = useState<PlaygroundTheme>(theme)
  const systemDark = useSystemDark()
  const resolvedTheme = themeChoice === "system" ? (systemDark ? "dark" : "light") : themeChoice
  const [shareLabel, setShareLabel] = useState("공유 링크 복사")
  const [exampleId, setExampleId] = useState("")
  // JS 가져오기: 창이 열려 있는지, 붙여 넣은 JS, 바꾸지 못한 이유, 바꾼 뒤 안내(그 코드를 고치기 전까지만 보임)
  const importId = useId()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [importError, setImportError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; code: string } | null>(null)

  const hnHost = useRef<HTMLDivElement>(null)
  const jsHost = useRef<HTMLDivElement>(null)
  const sandboxHost = useRef<HTMLDivElement>(null)
  const consoleBody = useRef<HTMLDivElement>(null)
  const hnView = useRef<EditorView | null>(null)
  const jsView = useRef<EditorView | null>(null)
  const runHandle = useRef<RunHandle | null>(null)

  useEffect(() => setThemeChoice(theme), [theme])

  // ── 실행 ──
  const outcomeRef = useRef<CompileOutcome>(outcome)
  outcomeRef.current = outcome

  const stop = useCallback(() => {
    runHandle.current?.stop()
    runHandle.current = null
    dispatch({ type: "stop" })
  }, [])

  const execute = useCallback(() => {
    const current = outcomeRef.current
    if (!current.ok || !sandboxHost.current) return
    runHandle.current?.stop()
    dispatch({ type: "start" })
    runHandle.current = startRun({
      host: sandboxHost.current,
      code: current.code,
      loopLimitMs,
      idleTimeoutMs: loopLimitMs + 2000,
      onEvent: (event) => dispatch({ type: "event", event }),
      onTimeout: (seconds) => {
        runHandle.current = null
        dispatch({ type: "timeout", seconds })
      },
    })
  }, [loopLimitMs])

  const executeRef = useRef(execute)
  executeRef.current = execute

  useEffect(() => () => runHandle.current?.stop(), [])

  // ── 에디터 만들기 (브라우저에서만: SSR 중에는 실행되지 않는다) ──
  useEffect(() => {
    if (!hnHost.current || !jsHost.current) return
    const hn = new EditorView({
      parent: hnHost.current,
      state: EditorState.create({
        doc: code,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          EditorState.tabSize.of(2),
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                executeRef.current()
                return true
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          hnLanguage(),
          editorTheme,
          EditorView.contentAttributes.of({ "aria-label": "한남랭 코드 편집기" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) setCode(update.state.doc.toString())
          }),
        ],
      }),
    })
    const js = new EditorView({
      parent: jsHost.current,
      state: EditorState.create({
        doc: lastGoodJs.current,
        extensions: [
          lineNumbers(),
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorState.tabSize.of(2),
          jsHighlighting(),
          editorTheme,
          EditorView.contentAttributes.of({ "aria-label": "변환된 JavaScript" }),
        ],
      }),
    })
    hnView.current = hn
    jsView.current = js
    return () => {
      hn.destroy()
      js.destroy()
      hnView.current = null
      jsView.current = null
    }
    // 에디터는 처음 한 번만 만든다. 이후 코드 교체는 replaceCode로 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const replaceCode = useCallback((next: string) => {
    const view = hnView.current
    if (!view) {
      setCode(next)
      return
    }
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } })
  }, [])

  // ── 변환 결과를 에디터에 반영 (JS 출력, 에러 밑줄) ──
  useEffect(() => {
    const hn = hnView.current
    const js = jsView.current
    if (!hn || !js) return
    const diagnostics = outcome.ok
      ? []
      : [
          {
            from: Math.min(outcome.diagnostic.from, hn.state.doc.length),
            to: Math.min(outcome.diagnostic.to, hn.state.doc.length),
            severity: "error" as const,
            message: outcome.diagnostic.message,
            source: "hannam-lang",
          },
        ]
    hn.dispatch(setDiagnostics(hn.state, diagnostics))
    const nextJs = lastGoodJs.current
    if (js.state.doc.toString() !== nextJs) {
      js.dispatch({ changes: { from: 0, to: js.state.doc.length, insert: nextJs } })
    }
  }, [outcome])

  // ── URL 해시 동기화 ──
  useEffect(() => {
    if (!syncUrl) return
    const load = () => {
      const fromHash = decodeHash(window.location.hash)
      if (fromHash !== null) replaceCode(fromHash)
    }
    load()
    window.addEventListener("hashchange", load)
    return () => window.removeEventListener("hashchange", load)
  }, [syncUrl, replaceCode])

  useEffect(() => {
    if (!syncUrl) return
    // 아직 아무것도 고치지 않았으면 주소를 길게 만들지 않는다
    if (!window.location.hash && code === startCode) return
    const timer = setTimeout(() => {
      const hash = encodeHash(code)
      if (window.location.hash !== hash) {
        // replaceState는 hashchange를 일으키지 않으므로 위의 load와 돌고 돌지 않는다
        window.history.replaceState(window.history.state, "", hash)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [code, syncUrl, startCode])

  const share = useCallback(async () => {
    const base = shareBaseUrl ?? window.location.href.split("#")[0]
    const url = `${base}${encodeHash(code)}`
    try {
      await navigator.clipboard.writeText(url)
      setShareLabel("복사했습니다")
    } catch {
      // 클립보드 권한이 없으면 주소창에라도 남긴다
      window.history.replaceState(window.history.state, "", encodeHash(code))
      setShareLabel("주소창의 링크를 복사하세요")
    }
    setTimeout(() => setShareLabel("공유 링크 복사"), 1800)
  }, [code, shareBaseUrl])

  const convertImport = useCallback(async () => {
    const outcome = await importJs(importText)
    if (!outcome.ok) {
      setImportError(outcome.message)
      return
    }
    replaceCode(outcome.code)
    setNotice({ text: importNotice(outcome), code: outcome.code })
    setExampleId("")
    setImportOpen(false)
    setImportText("")
    setImportError(null)
  }, [importText, replaceCode])

  // ── 콘솔 자동 스크롤 ──
  useEffect(() => {
    const el = consoleBody.current
    if (el) el.scrollTop = el.scrollHeight
  }, [run.logs])

  const running = run.status === "running"
  const style: CSSProperties = { height: typeof height === "number" ? `${height}px` : height }

  return (
    <div className="hnpg" data-theme={resolvedTheme} style={style}>
      <style>{PLAYGROUND_CSS}</style>
      <div className="hnpg-toolbar">
        {running ? (
          <button type="button" className="hnpg-btn hnpg-btn-primary" onClick={stop}>
            ■ 정지
          </button>
        ) : (
          <button
            type="button"
            className="hnpg-btn hnpg-btn-primary"
            onClick={execute}
            disabled={!outcome.ok}
            title={outcome.ok ? "실행 (Ctrl/⌘ + Enter)" : "변환 에러를 먼저 고치세요"}
          >
            ▶ 실행<span className="hnpg-kbd">⌘↵</span>
          </button>
        )}
        {showExamples && (
          <select
            className="hnpg-select"
            aria-label="예제 고르기"
            value={exampleId}
            onChange={(e) => {
              const example = EXAMPLES.find((x) => x.id === e.target.value)
              setExampleId(e.target.value)
              if (example) replaceCode(example.code)
            }}
          >
            <option value="" disabled>
              예제 고르기…
            </option>
            {EXAMPLES.map((example) => (
              <option key={example.id} value={example.id}>
                {example.title}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="hnpg-btn"
          aria-expanded={importOpen}
          onClick={() => {
            setImportOpen((open) => !open)
            setImportError(null)
          }}
        >
          JS 가져오기
        </button>
        <span className="hnpg-spacer" />
        <button type="button" className="hnpg-btn" onClick={share}>
          {shareLabel}
        </button>
        <button
          type="button"
          className="hnpg-btn"
          aria-label="테마 바꾸기"
          title="테마 바꾸기"
          onClick={() => setThemeChoice(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? "☀ 라이트" : "☾ 다크"}
        </button>
      </div>

      {importOpen && (
        <div className="hnpg-import" role="dialog" aria-label="JS를 한남랭으로 바꾸기">
          <label className="hnpg-import-label" htmlFor={importId}>
            JavaScript를 붙여 넣으면 한남랭으로 바꿔서 편집기에 넣습니다. 의미가 달라질 수 있는 곳은 JS 그대로 둡니다.
          </label>
          <textarea
            id={importId}
            className="hnpg-import-text"
            spellCheck={false}
            value={importText}
            placeholder={'const name = "철수"\nif (name) {\n  console.log(`안녕, ${name}`)\n}'}
            onChange={(e) => setImportText(e.target.value)}
            data-testid="import-text"
          />
          {importError && (
            <div className="hnpg-import-error" role="alert">
              {importError}
            </div>
          )}
          <div className="hnpg-import-actions">
            <button type="button" className="hnpg-btn" onClick={() => setImportOpen(false)}>
              닫기
            </button>
            <button
              type="button"
              className="hnpg-btn hnpg-btn-primary"
              onClick={convertImport}
              disabled={importText.trim() === ""}
            >
              한남랭으로 바꾸기
            </button>
          </div>
        </div>
      )}

      <div className="hnpg-main">
        <section className="hnpg-pane" aria-label="한남랭 코드">
          <div className="hnpg-pane-title">playground.hn</div>
          {notice && notice.code === code && (
            <div className="hnpg-notice" role="status" data-testid="import-notice">
              {notice.text}
            </div>
          )}
          <div className="hnpg-editor" ref={hnHost} data-testid="hn-editor" />
          {!outcome.ok && (
            <div className="hnpg-error-banner" role="alert" data-testid="compile-error">
              {outcome.diagnostic.line}:{outcome.diagnostic.column + 1} {outcome.diagnostic.message}
            </div>
          )}
        </section>
        <section className="hnpg-pane" aria-label="변환된 JavaScript">
          <div className="hnpg-pane-title">
            playground.js{!outcome.ok && " (변환 실패: 마지막 결과)"}
          </div>
          <div className={`hnpg-editor${outcome.ok ? "" : " hnpg-stale"}`} ref={jsHost} data-testid="js-output" />
        </section>
      </div>

      <section className="hnpg-console" aria-label="콘솔">
        <div className="hnpg-pane-title">
          콘솔
          <button type="button" className="hnpg-link-btn" onClick={() => dispatch({ type: "clear" })}>
            지우기
          </button>
          <span className={`hnpg-status hnpg-status-${run.status}`} data-testid="run-status">
            {STATUS_LABEL[run.status]}
          </span>
        </div>
        <div className="hnpg-console-body" ref={consoleBody} data-testid="console" role="log">
          {run.logs.length === 0 ? (
            <div className="hnpg-console-empty">▶ 실행을 누르면 출력이 여기에 나옵니다</div>
          ) : (
            run.logs.map((log) => (
              <div key={log.id} className={`hnpg-log hnpg-log-${log.level}`}>
                {log.text}
              </div>
            ))
          )}
        </div>
      </section>
      <div ref={sandboxHost} style={{ position: "relative", width: 0, height: 0, overflow: "hidden" }} />
    </div>
  )
}

/** 운영체제 다크 모드 여부. 서버 렌더링과 첫 렌더에서는 false */
function useSystemDark(): boolean {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    setDark(query.matches)
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])
  return dark
}
