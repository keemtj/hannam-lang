// hnc --from-js: JS 파일을 .hn으로 옮긴다. 기본은 바뀔 내용만 보여 주고, --write를 줘야 파일을 만든다
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { MigrateError, migrate } from "@hannam-lang/core/migrate"

/** 한 줄이 이보다 길면 압축된 파일로 보고 건너뛴다 */
const MAX_LINE = 1000

/**
 * @param {string[]} inputs 파일이나 디렉터리
 * @param {{ write: boolean, comments: boolean }} options
 * @returns {number} 종료 코드
 */
export function runMigrate(inputs, options) {
  const out = (/** @type {string} */ text) => process.stdout.write(`${text}\n`)
  const err = (/** @type {string} */ text) => process.stderr.write(`hnc: ${text}\n`)
  const rel = (/** @type {string} */ path) => relative(process.cwd(), path)
  let failed = false

  /** @type {string[]} */
  const files = []
  for (const input of inputs) {
    const abs = resolve(input)
    let stat
    try {
      stat = statSync(abs)
    } catch {
      err(`파일을 찾을 수 없습니다: ${input}`)
      failed = true
      continue
    }
    if (stat.isDirectory()) files.push(...findJs(abs))
    else if (/\.m?js$/.test(abs)) files.push(abs)
    else {
      err(`.js나 .mjs 파일이 아닙니다: ${input}`)
      failed = true
    }
  }
  const targets = withoutIgnored([...new Set(files)])
  const moving = new Set(targets)

  let changes = 0
  let converted = 0
  for (const file of targets) {
    const source = readFileSync(file, "utf8")
    if (source.split("\n").some((line) => line.length > MAX_LINE)) {
      out(`건너뜀 ${rel(file)}: 한 줄이 ${MAX_LINE}자를 넘어 압축된 파일로 보입니다`)
      continue
    }
    /** @type {import("@hannam-lang/core/migrate").MigrateResult} */
    let result
    try {
      result = migrate(source, {
        filename: rel(file),
        comments: options.comments,
        // 함께 옮기는 파일을 가리키는 상대 경로만 .hn으로 바꾼다
        rewriteImport: (spec) => {
          if (!/^\.\.?\//.test(spec) || !/\.m?js$/.test(spec)) return undefined
          return moving.has(resolve(dirname(file), spec)) ? spec.replace(/\.m?js$/, ".hn") : undefined
        },
      })
    } catch (error) {
      if (!(error instanceof MigrateError)) throw error
      err(error.message)
      failed = true
      continue
    }

    const target = file.replace(/\.m?js$/, ".hn")
    converted++
    changes += result.changes
    out(`${rel(file)} → ${rel(target)} (변환 ${result.changes}곳, 그대로 둔 곳 ${result.skipped.length}곳)`)
    if (!options.write) {
      for (const line of diffLines(source, result.code)) out(line)
    }
    for (const s of result.skipped) out(`  그대로 둠 ${s.line}:${s.column + 1} ${s.kind}: ${s.reason}`)
    if (options.write) {
      if (existsSync(target)) {
        err(`이미 있어서 덮어쓰지 않았습니다: ${rel(target)}`)
        failed = true
        continue
      }
      writeFileSync(target, result.code)
    }
  }

  out("")
  out(`파일 ${converted}개, 변환 ${changes}곳.`)
  if (options.write) {
    out("원래 .js 파일은 그대로 두었습니다. 확인한 뒤 직접 지우세요.")
  } else if (converted > 0) {
    out("바뀔 내용만 보여 줬습니다. --write를 주면 원본 옆에 .hn 파일을 만듭니다.")
  }
  if (converted > 0) out("Prettier, ESLint 같은 도구는 .hn 파일을 읽지 못합니다. 서식을 정리하려면 옮기기 전에 돌리세요.")
  return failed ? 1 : 0
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function findJs(dir) {
  /** @type {string[]} */
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...findJs(full))
    else if (entry.isFile() && /\.m?js$/.test(entry.name) && !/\.min\.m?js$/.test(entry.name)) found.push(full)
  }
  return found.sort()
}

/**
 * git 저장소 안이면 .gitignore에 걸리는 파일(빌드 결과물 등)을 뺀다. git이 없으면 그대로 둔다
 * @param {string[]} files
 * @returns {string[]}
 */
function withoutIgnored(files) {
  if (files.length === 0) return files
  const r = spawnSync("git", ["check-ignore", "--stdin"], { input: files.join("\n"), encoding: "utf8" })
  // 0: 무시되는 파일이 있음, 1: 없음. 그 밖(git 없음, 저장소 밖)은 거르지 않는다
  if (r.error || (r.status !== 0 && r.status !== 1)) return files
  const ignored = new Set(r.stdout.split("\n").filter(Boolean).map((p) => resolve(p)))
  return files.filter((f) => !ignored.has(f))
}

/**
 * 줄 단위 차이를 `-`/`+` 줄로 보여 준다 (Myers 알고리즘)
 * @param {string} before
 * @param {string} after
 * @returns {string[]}
 */
export function diffLines(before, after) {
  const a = before.split("\n")
  const b = after.split("\n")
  const n = a.length
  const m = b.length
  const max = n + m
  /** @type {Map<number, number>[]} */
  const trace = []
  /** @type {Map<number, number>} */
  let v = new Map([[1, 0]])
  outer: for (let d = 0; d <= max; d++) {
    trace.push(new Map(v))
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1))
      let x = down ? (v.get(k + 1) ?? 0) : (v.get(k - 1) ?? 0) + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v.set(k, x)
      if (x >= n && y >= m) break outer
    }
  }
  /** @type {{ op: "=" | "-" | "+", line: string, at: number }[]} */
  const ops = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
    const vd = /** @type {Map<number, number>} */ (trace[d])
    const k = x - y
    const down = k === -d || (k !== d && (vd.get(k - 1) ?? -1) < (vd.get(k + 1) ?? -1))
    const prevK = down ? k + 1 : k - 1
    const prevX = vd.get(prevK) ?? 0
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      x--
      y--
      ops.push({ op: "=", line: /** @type {string} */ (a[x]), at: x + 1 })
    }
    if (d === 0) break
    // at은 원본 기준 줄 번호다. 추가된 줄은 원본의 그 줄 앞에 들어간다
    if (down) ops.push({ op: "+", line: /** @type {string} */ (b[--y]), at: x + 1 })
    else ops.push({ op: "-", line: /** @type {string} */ (a[--x]), at: x + 1 })
  }
  ops.reverse()

  /** @type {string[]} */
  const lines = []
  let prevChanged = false
  for (const o of ops) {
    if (o.op === "=") {
      prevChanged = false
      continue
    }
    if (!prevChanged) lines.push(`  @@ ${o.at}번째 줄`)
    lines.push(`  ${o.op} ${o.line.replace(/\r$/, "")}`)
    prevChanged = true
  }
  return lines
}
