// hnc --from-js: JS 파일을 .hn으로 옮긴다. 기본은 바뀔 내용만 보여 주고, --write를 줘야 파일을 만든다
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { MigrateError, migrate } from "@hannam-lang/core/migrate"

/** 한 줄이 이보다 길면 압축된 파일로 보고 건너뛴다 */
const MAX_LINE = 1000
/** 차이를 계산할 때 허용하는 최대 편집 거리. 넘으면 차이를 생략한다 (메모리는 이 값의 제곱에 비례) */
const MAX_DIFF = 2000

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

  // ── 1. 대상 모으기 ──
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
    if (stat.isDirectory()) {
      // .gitignore는 폴더를 훑어 찾은 파일에만 적용한다. 직접 지정한 파일은 그대로 옮긴다
      const found = findJs(abs)
      const kept = withoutIgnored(abs, found)
      if (kept.length < found.length) out(`건너뜀 ${found.length - kept.length}개: ${rel(abs) || "."} 안에서 .gitignore에 든 파일`)
      files.push(...kept)
    } else if (/\.min\.m?js$/.test(abs)) {
      out(`건너뜀 ${rel(abs)}: 압축된 파일(*.min.js)은 옮기지 않습니다`)
    } else if (/\.m?js$/.test(abs)) {
      files.push(abs)
    } else {
      err(`.js나 .mjs 파일이 아닙니다: ${input}`)
      failed = true
    }
  }

  // ── 2. 옮길 파일 정하기: 실제로 .hn을 만들 파일만 import 경로를 바꾸는 기준이 된다 ──
  /** @type {Map<string, string[]>} .hn 경로 → 그 경로로 바뀌는 원본들 */
  const byTarget = new Map()
  for (const file of new Set(files)) {
    const target = toHn(file)
    byTarget.set(target, [...(byTarget.get(target) ?? []), file])
  }
  /** @type {{ file: string, target: string, source: string }[]} */
  const plan = []
  for (const [target, sources] of byTarget) {
    if (sources.length > 1) {
      err(`같은 .hn으로 바뀌는 파일이 여럿입니다: ${sources.map(rel).join(", ")} → ${rel(target)}`)
      failed = true
      continue
    }
    const file = /** @type {string} */ (sources[0])
    const source = readFileSync(file, "utf8")
    if (source.split("\n").some((line) => line.length > MAX_LINE)) {
      out(`건너뜀 ${rel(file)}: 한 줄이 ${MAX_LINE}자를 넘어 압축된 파일로 보입니다`)
      continue
    }
    if (existsSync(target)) {
      if (options.write) {
        err(`이미 있어서 덮어쓰지 않았습니다: ${rel(target)}`)
        failed = true
      } else {
        out(`건너뜀 ${rel(file)}: ${rel(target)}이 이미 있어서 --write를 줘도 덮어쓰지 않습니다`)
      }
      continue
    }
    try {
      migrate(source, { filename: rel(file), comments: options.comments })
    } catch (error) {
      if (!(error instanceof MigrateError)) throw error
      err(error.message)
      failed = true
      continue
    }
    plan.push({ file, target, source })
  }
  const moving = new Set(plan.map((p) => p.file))

  // ── 3. 옮기기 ──
  let changes = 0
  for (const { file, target, source } of plan) {
    const result = migrate(source, {
      filename: rel(file),
      comments: options.comments,
      // 실제로 함께 옮기는 파일을 가리키는 상대 경로만 .hn으로 바꾼다
      rewriteImport: (spec) => {
        if (!/^\.\.?\//.test(spec) || !/\.m?js$/.test(spec)) return undefined
        return moving.has(resolve(dirname(file), spec)) ? spec.replace(/\.m?js$/, ".hn") : undefined
      },
    })
    changes += result.changes
    out(`${rel(file)} → ${rel(target)} (변환 ${result.changes}곳, 그대로 둔 곳 ${result.skipped.length}곳)`)
    if (!options.write) {
      for (const line of diffLines(source, result.code)) out(line)
    }
    for (const s of result.skipped) out(`  그대로 둠 ${s.line}:${s.column + 1} ${s.kind}: ${s.reason}`)
    if (options.write) writeFileSync(target, result.code)
  }

  out("")
  out(`파일 ${plan.length}개, 변환 ${changes}곳.`)
  if (options.write) {
    if (plan.length > 0) out("원래 .js 파일은 그대로 두었습니다. 확인한 뒤 직접 지우세요.")
  } else if (plan.length > 0) {
    out("바뀔 내용만 보여 줬습니다. --write를 주면 원본 옆에 .hn 파일을 만듭니다.")
  }
  if (plan.length > 0) {
    out("Prettier, ESLint 같은 도구는 .hn 파일을 읽지 못합니다. 서식을 정리하려면 옮기기 전에 돌리세요.")
    if (plan.some((p) => p.file.endsWith(".mjs"))) {
      out('.mjs에서 옮긴 .hn은 hnc로 컴파일하면 .js가 됩니다. package.json에 "type": "module"이 있는지 확인하세요.')
    }
  }
  return failed ? 1 : 0
}

/** @param {string} file */
function toHn(file) {
  return file.replace(/\.m?js$/, ".hn")
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
 * dir이 git 저장소 안이면 .gitignore에 걸리는 파일(빌드 결과물 등)을 뺀다. git이 없거나 저장소 밖이면 그대로 둔다
 * @param {string} dir
 * @param {string[]} files
 * @returns {string[]}
 */
function withoutIgnored(dir, files) {
  if (files.length === 0) return files
  // 현재 디렉터리가 아니라 그 폴더가 속한 저장소를 기준으로 판단한다
  const r = spawnSync("git", ["-C", dir, "check-ignore", "--stdin"], { input: files.join("\n"), encoding: "utf8" })
  // 0: 무시되는 파일이 있음, 1: 없음. 그 밖(git 없음, 저장소 밖)은 거르지 않는다
  if (r.error || (r.status !== 0 && r.status !== 1)) return files
  const ignored = new Set(r.stdout.split("\n").filter(Boolean).map((p) => resolve(dir, p)))
  return files.filter((f) => !ignored.has(f))
}

/**
 * 줄 단위 차이를 `-`/`+` 줄로 보여 준다
 * @param {string} before
 * @param {string} after
 * @returns {string[]}
 */
export function diffLines(before, after) {
  const a = before.split("\n")
  const b = after.split("\n")
  // 역변환은 대부분 줄 수를 그대로 두므로, 줄 수가 같으면 줄끼리 바로 비교한다
  const ops = a.length === b.length ? pairwise(a, b) : myers(a, b)
  if (!ops) return [`  (바뀐 줄이 너무 많아 차이를 생략합니다)`]

  /** @type {string[]} */
  const lines = []
  for (let i = 0; i < ops.length; ) {
    const first = /** @type {DiffOp} */ (ops[i])
    if (first.op === "=") {
      i++
      continue
    }
    // 연속으로 바뀐 줄을 하나로 묶어 - 줄을 먼저, + 줄을 나중에 보여 준다
    let j = i
    while (j < ops.length && /** @type {DiffOp} */ (ops[j]).op !== "=") j++
    const hunk = ops.slice(i, j)
    lines.push(`  @@ ${first.at}번째 줄`)
    for (const o of hunk) if (o.op === "-") lines.push(`  - ${o.line.replace(/\r$/, "")}`)
    for (const o of hunk) if (o.op === "+") lines.push(`  + ${o.line.replace(/\r$/, "")}`)
    i = j
  }
  return lines
}

/** @typedef {{ op: "=" | "-" | "+", line: string, at: number }} DiffOp at은 원본 기준 줄 번호 */

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {DiffOp[]}
 */
function pairwise(a, b) {
  /** @type {DiffOp[]} */
  const ops = []
  a.forEach((line, i) => {
    const next = /** @type {string} */ (b[i])
    if (line === next) ops.push({ op: "=", line, at: i + 1 })
    else ops.push({ op: "-", line, at: i + 1 }, { op: "+", line: next, at: i + 1 })
  })
  return ops
}

/**
 * Myers 차이 알고리즘. 편집 거리가 MAX_DIFF를 넘으면 null
 * @param {string[]} a
 * @param {string[]} b
 * @returns {DiffOp[] | null}
 */
function myers(a, b) {
  const n = a.length
  const m = b.length
  const off = n + m + 1
  const v = new Int32Array(2 * off + 2)
  /** @type {Int32Array[]} 각 d를 시작할 때 v의 [-d-1, d+1] 구간 */
  const trace = []
  for (let d = 0; d <= Math.min(n + m, MAX_DIFF); d++) {
    trace.push(v.slice(off - d - 1, off + d + 2))
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && /** @type {number} */ (v[off + k - 1]) < /** @type {number} */ (v[off + k + 1]))
      let x = down ? /** @type {number} */ (v[off + k + 1]) : /** @type {number} */ (v[off + k - 1]) + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[off + k] = x
      if (x >= n && y >= m) return backtrack(a, b, trace, d)
    }
  }
  return null
}

/**
 * @param {string[]} a
 * @param {string[]} b
 * @param {Int32Array[]} trace
 * @param {number} last
 * @returns {DiffOp[]}
 */
function backtrack(a, b, trace, last) {
  /** @type {DiffOp[]} */
  const ops = []
  let x = a.length
  let y = b.length
  for (let d = last; d >= 0; d--) {
    const snap = /** @type {Int32Array} */ (trace[d])
    const get = (/** @type {number} */ k) => /** @type {number} */ (snap[k + d + 1])
    const k = x - y
    const down = k === -d || (k !== d && get(k - 1) < get(k + 1))
    const prevK = down ? k + 1 : k - 1
    const prevX = get(prevK)
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      x--
      y--
      ops.push({ op: "=", line: /** @type {string} */ (a[x]), at: x + 1 })
    }
    if (d === 0) break
    // 추가된 줄은 원본의 그 줄 앞에 들어간다
    if (down) ops.push({ op: "+", line: /** @type {string} */ (b[--y]), at: x + 1 })
    else ops.push({ op: "-", line: /** @type {string} */ (a[--x]), at: x + 1 })
  }
  return ops.reverse()
}
