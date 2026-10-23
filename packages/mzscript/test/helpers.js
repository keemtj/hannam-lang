import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export const PKG_DIR = fileURLToPath(new URL("..", import.meta.url))
export const MZ = join(PKG_DIR, "bin/mz.js")
export const MZC = join(PKG_DIR, "bin/mzc.js")

/** @type {string[]} */
const dirs = []

/**
 * 임시 디렉터리에 파일들을 만든다
 * @param {Record<string, string>} files 상대 경로 → 내용
 */
export function project(files) {
  const root = mkdtempSync(join(tmpdir(), "mzscript-test-"))
  dirs.push(root)
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

export function cleanup() {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
}

/**
 * @param {string[]} args
 * @param {string} [cwd]
 */
export function node(args, cwd) {
  const r = spawnSync(process.execPath, args, { cwd, encoding: "utf8" })
  return { status: r.status, stdout: r.stdout, stderr: r.stderr }
}
