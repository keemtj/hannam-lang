// 한 버전의 GitHub 릴리스 본문을 만든다. 세 패키지 CHANGELOG에서 그 버전 절을 모은다(scripts/changelog.mjs).
// 사용법: node scripts/release-notes.mjs <버전>   (예: 0.1.0) → 표준 출력으로 마크다운
import { PACKAGES, collectVersions, sectionsFor } from "./changelog.mjs"

const version = process.argv[2]
if (!version) {
  console.error("사용법: node scripts/release-notes.mjs <버전>")
  process.exit(1)
}

const entries = collectVersions().find(([v]) => v === version)?.[1]
if (!entries) {
  console.error(`CHANGELOG에 ${version} 절이 없습니다`)
  process.exit(1)
}

const out = [
  ...sectionsFor(entries),
  "### Packages",
  "",
  ...PACKAGES.map((p) => `- [\`${p.name}@${version}\`](https://www.npmjs.com/package/${p.name}/v/${version})`),
  "",
]
process.stdout.write(out.join("\n"))
