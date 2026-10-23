// 세 패키지의 CHANGELOG.md를 읽어 버전별 변경 항목을 모은다.
// 세 패키지는 버전을 묶어(fixed) 함께 내므로 같은 항목은 한 번만 남긴다.
// GitHub 릴리스 본문(scripts/release-notes.mjs)과 사이트의 변경 기록 페이지가 함께 쓴다
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const PACKAGES = [
  { name: "mzscript", dir: "mzscript" },
  { name: "@mzscript/core", dir: "core" },
  { name: "@mzscript/vite-plugin", dir: "vite-plugin" },
]
export const KINDS = ["Major Changes", "Minor Changes", "Patch Changes"]

const root = fileURLToPath(new URL("..", import.meta.url))

// CHANGELOG 하나를 { 버전: [{ kind, text }] }로 나눈다. 항목은 "- "로 시작하고 들여 쓴 줄이 이어진다
function parse(changelog) {
  const versions = new Map()
  let entries
  let kind
  for (const line of changelog.split("\n")) {
    if (line.startsWith("## ")) {
      entries = []
      versions.set(line.slice(3).trim(), entries)
    } else if (!entries) {
      continue
    } else if (line.startsWith("### ")) {
      kind = line.slice(4).trim()
    } else if (line.startsWith("- ")) {
      entries.push({ kind, lines: [line] })
    } else if (entries.length && (line.startsWith("  ") || line.trim() === "")) {
      entries.at(-1).lines.push(line)
    }
  }
  for (const [version, list] of versions) {
    versions.set(
      version,
      list
        .map((e) => ({ kind: e.kind, text: e.lines.join("\n").trimEnd() }))
        // 묶음 버전이라 의존성 갱신 항목은 의미가 없다
        .filter((e) => !e.text.startsWith("- Updated dependencies")),
    )
  }
  return versions
}

// 새 버전이 앞에 오는 [버전, 항목[]] 배열. 세 패키지에서 같은 항목은 하나로 합친다
export function collectVersions() {
  const merged = new Map()
  for (const pkg of PACKAGES) {
    const changelog = readFileSync(`${root}packages/${pkg.dir}/CHANGELOG.md`, "utf8")
    for (const [version, entries] of parse(changelog)) {
      const seen = merged.get(version) ?? new Map()
      for (const e of entries) if (!seen.has(e.text)) seen.set(e.text, e.kind)
      merged.set(version, seen)
    }
  }
  const byNewest = (a, b) => b[0].localeCompare(a[0], undefined, { numeric: true })
  return [...merged].sort(byNewest).map(([version, seen]) => [version, [...seen].map(([text, kind]) => ({ kind, text }))])
}

// 한 버전의 항목을 종류별 "### 종류" 절로 쓴 마크다운 줄 배열
export function sectionsFor(entries, headingLevel = 3) {
  const hashes = "#".repeat(headingLevel)
  const out = []
  for (const kind of KINDS) {
    const texts = entries.filter((e) => e.kind === kind).map((e) => e.text)
    if (texts.length) out.push(`${hashes} ${kind}`, "", ...texts, "")
  }
  return out
}
