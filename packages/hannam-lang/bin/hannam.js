#!/usr/bin/env node
// hannam <file.hn> [args...]: .hn을 메모리에서 변환해 실행한다 (node, tsx 역할)
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { reportSyntaxError, version } from "../src/cli.js"

const HELP = `사용법: hannam <파일.hn> [인자...]

.hn 파일을 JS로 변환해 바로 실행합니다. .hn 파일끼리 import할 수 있습니다.

옵션:
  -h, --help     이 도움말을 출력합니다
  -v, --version  버전을 출력합니다

컴파일만 하려면 hnc를 쓰세요.`

const [entry, ...rest] = process.argv.slice(2)

if (entry === undefined) {
  process.stderr.write(`${HELP}\n`)
  process.exit(1)
}
if (entry === "-h" || entry === "--help") {
  process.stdout.write(`${HELP}\n`)
  process.exit(0)
}
if (entry === "-v" || entry === "--version") {
  process.stdout.write(`${version()}\n`)
  process.exit(0)
}
if (entry.startsWith("-")) {
  process.stderr.write(`hannam: 알 수 없는 옵션 '${entry}'\n\n${HELP}\n`)
  process.exit(1)
}

const file = resolve(entry)
if (!existsSync(file)) {
  process.stderr.write(`hannam: 파일을 찾을 수 없습니다: ${entry}\n`)
  process.exit(1)
}

await import("../src/register.js")

// 실행하는 스크립트가 node로 실행된 것처럼 process.argv를 보도록 맞춘다
process.argv = [process.argv[0] ?? process.execPath, file, ...rest]

try {
  await import(pathToFileURL(file).href)
} catch (error) {
  if (!reportSyntaxError(error)) throw error
  process.exitCode = 1
}
