#!/usr/bin/env node
// hnc(hannam compiler) <파일|디렉터리...> [--out-dir <dir>] [--source-map]: .hn을 .js로 컴파일한다 (tsc 역할)
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { compile } from "@hannam-lang/core"
import { reportSyntaxError, version } from "../src/cli.js"

const HELP = `hnc: hannam compiler

사용법: hnc <파일|디렉터리...> [옵션]

.hn 파일을 .js로 컴파일합니다. 디렉터리를 주면 그 안의 .hn을 모두 찾습니다 (node_modules 제외).
기본으로 원본 옆에 .js를 만듭니다.

옵션:
  -o, --out-dir <dir>  출력 디렉터리. 디렉터리 인자는 그 안의 구조를 유지합니다
  --source-map         .js.map 파일을 함께 만듭니다
  -h, --help           이 도움말을 출력합니다
  -v, --version        버전을 출력합니다`

/** @param {string} message */
function usageError(message) {
  process.stderr.write(`hnc: ${message}\n\n${HELP}\n`)
  process.exit(1)
}

/** @type {string[]} */
const inputs = []
/** @type {string | undefined} */
let outDir
let sourceMap = false

const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  const arg = /** @type {string} */ (args[i])
  if (arg === "-h" || arg === "--help") {
    process.stdout.write(`${HELP}\n`)
    process.exit(0)
  } else if (arg === "-v" || arg === "--version") {
    process.stdout.write(`${version()}\n`)
    process.exit(0)
  } else if (arg === "-o" || arg === "--out-dir") {
    outDir = args[++i]
    if (!outDir || outDir.startsWith("-")) usageError(`${arg} 뒤에 디렉터리가 필요합니다`)
  } else if (arg.startsWith("--out-dir=")) {
    outDir = arg.slice("--out-dir=".length)
    if (!outDir) usageError("--out-dir 뒤에 디렉터리가 필요합니다")
  } else if (arg === "--source-map") {
    sourceMap = true
  } else if (arg.startsWith("-")) {
    usageError(`알 수 없는 옵션 '${arg}'`)
  } else {
    inputs.push(arg)
  }
}
if (inputs.length === 0) usageError("컴파일할 파일이나 디렉터리를 주세요")

/** @type {string[]} */
const sources = []
/** 출력 구조의 기준 디렉터리 후보: 디렉터리 인자는 그 자신, 파일 인자는 그 파일이 있는 디렉터리 */
/** @type {string[]} */
const bases = []
let failed = false

for (const input of inputs) {
  const abs = resolve(input)
  let stat
  try {
    stat = statSync(abs)
  } catch {
    process.stderr.write(`hnc: 파일을 찾을 수 없습니다: ${input}\n`)
    failed = true
    continue
  }
  if (stat.isDirectory()) {
    try {
      sources.push(...findHn(abs))
    } catch (error) {
      reportFsError(input, error)
      continue
    }
    bases.push(abs)
  } else if (abs.endsWith(".hn")) {
    sources.push(abs)
    bases.push(dirname(abs))
  } else {
    process.stderr.write(`hnc: .hn 파일이 아닙니다: ${input}\n`)
    failed = true
  }
}

// --out-dir에서는 모든 입력의 공통 조상을 기준으로 디렉터리 구조를 유지한다 (같은 이름 파일이 덮어써지지 않게)
const root = commonDir(bases)
/** @type {Map<string, string>} 출력 경로 → 원본 */
const jobs = new Map()
for (const src of new Set(sources)) {
  const out = toJs(outDir ? join(resolve(outDir), relative(root, src)) : src)
  const other = jobs.get(out)
  if (other) {
    process.stderr.write(`hnc: 출력 경로가 겹칩니다: ${relative(process.cwd(), other)}, ${relative(process.cwd(), src)} → ${relative(process.cwd(), out)}\n`)
    failed = true
    continue
  }
  jobs.set(out, src)
}

for (const [out, src] of jobs) {
  try {
    compileFile(src, out)
  } catch (error) {
    if (!reportSyntaxError(error)) reportFsError(relative(process.cwd(), src), error)
    failed = true
  }
}

if (failed) process.exitCode = 1

/**
 * @param {string} where
 * @param {unknown} error
 */
function reportFsError(where, error) {
  process.stderr.write(`hnc: ${where}: ${error instanceof Error ? error.message : String(error)}\n`)
  failed = true
}

/**
 * @param {string[]} dirs
 * @returns {string}
 */
function commonDir(dirs) {
  if (dirs.length === 0) return process.cwd()
  let common = /** @type {string} */ (dirs[0])
  for (const dir of dirs.slice(1)) {
    while (relative(common, dir).startsWith("..") || isAbsolute(relative(common, dir))) common = dirname(common)
  }
  return common
}

/** @param {string} path */
function toJs(path) {
  return path.replace(/\.hn$/, ".js")
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function findHn(dir) {
  /** @type {string[]} */
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...findHn(full))
    else if (entry.isFile() && entry.name.endsWith(".hn")) found.push(full)
  }
  return found.sort()
}

/**
 * @param {string} src
 * @param {string} out
 */
function compileFile(src, out) {
  const source = readFileSync(src, "utf8")
  // 에러 메시지에는 현재 디렉터리 기준 경로를 보여 준다
  const { code, map, warnings } = compile(source, { filename: relative(process.cwd(), src), rewriteImports: true })
  for (const w of warnings) process.stderr.write(`hnc: 경고: ${w.text}\n`)
  mkdirSync(dirname(out), { recursive: true })
  if (sourceMap) {
    // 소스맵은 .map 파일 위치 기준 상대 경로로 원본을 가리켜야 한다
    const mapFile = `${basename(out)}.map`
    map.sources = [relative(dirname(out), src).split(sep).join("/")]
    map.file = basename(out)
    writeFileSync(`${out}.map`, map.toString())
    writeFileSync(out, `${code}${code.endsWith("\n") ? "" : "\n"}//# sourceMappingURL=${encodeURI(mapFile)}\n`)
  } else {
    writeFileSync(out, code)
  }
}
