// 한 버전의 GitHub 릴리스 본문을 만든다. 세 패키지는 버전을 묶어(fixed) 함께 내므로
// 각 패키지 CHANGELOG.md에서 그 버전 절을 모아, 같은 항목은 한 번만 적는다.
// 사용법: node scripts/release-notes.mjs <버전>   (예: 0.1.0) → 표준 출력으로 마크다운
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const PACKAGES = [
  { name: "hannam-lang", dir: "hannam-lang" },
  { name: "@hannam-lang/core", dir: "core" },
  { name: "@hannam-lang/vite-plugin", dir: "vite-plugin" },
]
const KINDS = ["Major Changes", "Minor Changes", "Patch Changes"]

const version = process.argv[2]
if (!version) {
  console.error("사용법: node scripts/release-notes.mjs <버전>")
  process.exit(1)
}

// "## <버전>" 절 안의 "### 종류"별 항목을 읽는다. 항목은 "- "로 시작하고 들여 쓴 줄이 이어진다
function entriesOf(changelog) {
  const lines = changelog.split("\n")
  const start = lines.findIndex((line) => line.trim() === `## ${version}`)
  if (start === -1) return []
  const entries = []
  let kind
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break
    if (line.startsWith("### ")) {
      kind = line.slice(4).trim()
    } else if (line.startsWith("- ")) {
      entries.push({ kind, lines: [line] })
    } else if (entries.length && (line.startsWith("  ") || line.trim() === "")) {
      entries.at(-1).lines.push(line)
    }
  }
  return entries
    .map((e) => ({ kind: e.kind, text: e.lines.join("\n").trimEnd() }))
    .filter((e) => !e.text.startsWith("- Updated dependencies")) // 묶음 버전이라 의존성 갱신 항목은 의미가 없다
}

const root = fileURLToPath(new URL("..", import.meta.url))
const seen = new Map() // 항목 본문 → 종류
for (const pkg of PACKAGES) {
  const changelog = readFileSync(`${root}packages/${pkg.dir}/CHANGELOG.md`, "utf8")
  for (const entry of entriesOf(changelog)) if (!seen.has(entry.text)) seen.set(entry.text, entry.kind)
}

const out = []
for (const kind of KINDS) {
  const texts = [...seen].filter(([, k]) => k === kind).map(([text]) => text)
  if (texts.length) out.push(`### ${kind}`, "", ...texts, "")
}
out.push(
  "### Packages",
  "",
  ...PACKAGES.map((p) => `- [\`${p.name}@${version}\`](https://www.npmjs.com/package/${p.name}/v/${version})`),
  "",
)
process.stdout.write(out.join("\n"))
