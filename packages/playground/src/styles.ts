// 컴포넌트 전용 CSS. 문서 사이트의 스타일과 섞이지 않게 모든 선택자를 `.hnpg` 아래에 둔다.
// 테마는 루트의 data-theme 값으로 CSS 변수만 바꾼다.

export const PLAYGROUND_CSS = `
.hnpg {
  --hnpg-mono: ui-monospace, SFMono-Regular, "D2Coding", Menlo, Consolas, monospace;
  --hnpg-sans: system-ui, -apple-system, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif;
  --hnpg-bg: #ffffff;
  --hnpg-panel-bg: #f6f7f9;
  --hnpg-editor-bg: #ffffff;
  --hnpg-fg: #1f2328;
  --hnpg-muted: #8b949e;
  --hnpg-border: #d8dee4;
  --hnpg-accent: #d6336c;
  --hnpg-accent-fg: #ffffff;
  --hnpg-selection: #d6336c33;
  --hnpg-active-line: #f3f4f6;
  --hnpg-error: #d1242f;
  --hnpg-error-bg: #ffebe9;
  --hnpg-warn: #9a6700;
  --hnpg-info: #0969da;
  --hnpg-syn-hn: #d6336c;
  --hnpg-syn-keyword: #8250df;
  --hnpg-syn-string: #0a3069;
  --hnpg-syn-number: #0550ae;
  --hnpg-syn-comment: #6e7781;
  --hnpg-syn-function: #6639ba;
  --hnpg-syn-class: #953800;
  --hnpg-syn-property: #24292f;
  color-scheme: light;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  border: 1px solid var(--hnpg-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--hnpg-bg);
  color: var(--hnpg-fg);
  font-family: var(--hnpg-sans);
  font-size: 14px;
  text-align: left;
}
.hnpg[data-theme="dark"] {
  --hnpg-bg: #0d1117;
  --hnpg-panel-bg: #161b22;
  --hnpg-editor-bg: #0d1117;
  --hnpg-fg: #e6edf3;
  --hnpg-muted: #7d8590;
  --hnpg-border: #30363d;
  --hnpg-accent: #f06595;
  --hnpg-accent-fg: #0d1117;
  --hnpg-selection: #f0659544;
  --hnpg-active-line: #161b22;
  --hnpg-error: #ff7b72;
  --hnpg-error-bg: #ff7b7222;
  --hnpg-warn: #d29922;
  --hnpg-info: #79c0ff;
  --hnpg-syn-hn: #f783ac;
  --hnpg-syn-keyword: #d2a8ff;
  --hnpg-syn-string: #a5d6ff;
  --hnpg-syn-number: #79c0ff;
  --hnpg-syn-comment: #8b949e;
  --hnpg-syn-function: #d2a8ff;
  --hnpg-syn-class: #ffa657;
  --hnpg-syn-property: #e6edf3;
  color-scheme: dark;
}
.hnpg *, .hnpg *::before, .hnpg *::after { box-sizing: border-box; }

.hnpg-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--hnpg-panel-bg);
  border-bottom: 1px solid var(--hnpg-border);
}
.hnpg-spacer { flex: 1; }
.hnpg-btn, .hnpg-select {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--hnpg-border);
  border-radius: 6px;
  background: var(--hnpg-bg);
  color: var(--hnpg-fg);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.hnpg-btn:hover:not(:disabled), .hnpg-select:hover { border-color: var(--hnpg-muted); }
.hnpg-btn:focus-visible, .hnpg-select:focus-visible { outline: 2px solid var(--hnpg-accent); outline-offset: 1px; }
.hnpg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.hnpg-btn-primary {
  background: var(--hnpg-accent);
  border-color: var(--hnpg-accent);
  color: var(--hnpg-accent-fg);
  font-weight: 600;
}
.hnpg-btn-primary:hover:not(:disabled) { filter: brightness(1.08); border-color: var(--hnpg-accent); }
.hnpg-kbd { margin-left: 6px; opacity: 0.7; font-size: 11px; font-weight: 400; }

.hnpg-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.hnpg-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.hnpg-pane + .hnpg-pane { border-left: 1px solid var(--hnpg-border); }
.hnpg-pane-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--hnpg-muted);
  background: var(--hnpg-panel-bg);
  border-bottom: 1px solid var(--hnpg-border);
}
.hnpg-editor { flex: 1; min-height: 0; overflow: hidden; }
.hnpg-editor .cm-editor { height: 100%; }
.hnpg-editor .cm-editor.cm-focused { outline: none; }
.hnpg-stale .cm-content { opacity: 0.45; }

.hnpg-error-banner {
  padding: 6px 12px;
  border-top: 1px solid var(--hnpg-border);
  background: var(--hnpg-error-bg);
  color: var(--hnpg-error);
  font-family: var(--hnpg-mono);
  font-size: 12px;
  white-space: pre-wrap;
  max-height: 30%;
  overflow: auto;
}

.hnpg-console {
  height: 32%;
  min-height: 90px;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--hnpg-border);
}
.hnpg-console-body {
  flex: 1;
  overflow: auto;
  padding: 4px 0;
  font-family: var(--hnpg-mono);
  font-size: 12.5px;
  background: var(--hnpg-editor-bg);
}
.hnpg-log {
  padding: 2px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  border-bottom: 1px solid color-mix(in srgb, var(--hnpg-border) 40%, transparent);
}
.hnpg-log-error { color: var(--hnpg-error); background: var(--hnpg-error-bg); }
.hnpg-log-warn { color: var(--hnpg-warn); }
.hnpg-log-info { color: var(--hnpg-info); }
.hnpg-log-system { color: var(--hnpg-muted); font-style: italic; }
.hnpg-console-empty { padding: 6px 12px; color: var(--hnpg-muted); font-family: var(--hnpg-sans); }
.hnpg-status { margin-left: auto; }
.hnpg-status-running { color: var(--hnpg-info); }
.hnpg-status-timeout, .hnpg-status-stopped { color: var(--hnpg-warn); }
.hnpg-link-btn {
  border: none;
  background: none;
  color: var(--hnpg-muted);
  font: inherit;
  cursor: pointer;
  padding: 0;
}
.hnpg-link-btn:hover { color: var(--hnpg-fg); }

@media (max-width: 720px) {
  .hnpg-main { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  .hnpg-pane + .hnpg-pane { border-left: none; border-top: 1px solid var(--hnpg-border); }
}
`
