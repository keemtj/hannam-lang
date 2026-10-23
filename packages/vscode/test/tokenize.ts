// vscode-textmate + vscode-oniguruma로 .mz 소스를 실제 VS Code와 같은 방식으로 토큰화한다
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import oniguruma from "vscode-oniguruma"
import textmate from "vscode-textmate"

const require = createRequire(import.meta.url)
const packageRoot = fileURLToPath(new URL("..", import.meta.url))

const grammarPaths: Record<string, string> = {
  "source.mz": `${packageRoot}syntaxes/mzscript.tmLanguage.json`,
  // VS Code 1.140.0 내장 JavaScript 문법 (MIT, 같은 폴더의 LICENSE.txt 참고)
  "source.js": `${packageRoot}test/fixtures/vscode-javascript/JavaScript.tmLanguage.json`,
}

export interface Token {
  line: number
  text: string
  scopes: string[]
}

let registryPromise: Promise<textmate.Registry> | undefined

function createRegistry(): Promise<textmate.Registry> {
  const wasm = readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm"))
  const ready = oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength))
  return ready.then(
    () =>
      new textmate.Registry({
        onigLib: Promise.resolve({
          createOnigScanner: (sources) => new oniguruma.OnigScanner(sources),
          createOnigString: (text) => new oniguruma.OnigString(text),
        }),
        loadGrammar: async (scopeName) => {
          const path = grammarPaths[scopeName]
          if (!path) return null
          return textmate.parseRawGrammar(readFileSync(path, "utf8"), path)
        },
      }),
  )
}

export async function tokenize(source: string): Promise<Token[]> {
  registryPromise ??= createRegistry()
  const grammar = await (await registryPromise).loadGrammar("source.mz")
  if (!grammar) throw new Error("source.mz 문법을 불러오지 못함")
  const tokens: Token[] = []
  let ruleStack = textmate.INITIAL
  source.split(/\r?\n/).forEach((text, index) => {
    const result = grammar.tokenizeLine(text, ruleStack)
    for (const token of result.tokens) {
      tokens.push({ line: index + 1, text: text.slice(token.startIndex, token.endIndex), scopes: token.scopes })
    }
    ruleStack = result.ruleStack
  })
  return tokens
}
