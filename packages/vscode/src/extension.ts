import * as vscode from "vscode"
import { collectDiagnostics } from "./diagnostics.ts"

// .mz 문서를 열거나 고칠 때 컴파일해서 에러는 빨간 밑줄, 경고는 노란 밑줄로 보여 준다
const DEBOUNCE_MS = 250

export function activate(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection("mzscript")
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const refresh = (doc: vscode.TextDocument) => {
    if (doc.languageId !== "mzscript") return
    const items = collectDiagnostics(doc.getText(), doc.fileName).map((d) => {
      const range = new vscode.Range(d.line, d.startColumn, d.line, d.endColumn)
      const severity = d.severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
      const diagnostic = new vscode.Diagnostic(range, d.message, severity)
      diagnostic.source = "mzscript"
      return diagnostic
    })
    collection.set(doc.uri, items)
  }

  const schedule = (doc: vscode.TextDocument) => {
    const key = doc.uri.toString()
    clearTimeout(timers.get(key))
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        refresh(doc)
      }, DEBOUNCE_MS),
    )
  }

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      const key = doc.uri.toString()
      clearTimeout(timers.get(key))
      timers.delete(key)
      collection.delete(doc.uri)
    }),
    { dispose: () => timers.forEach(clearTimeout) },
  )
  vscode.workspace.textDocuments.forEach(refresh)
}

export function deactivate(): void {}
