// 세 패키지의 CHANGELOG.md로 문서의 "변경 기록" 페이지(content/docs/changelog.mdx)를 만든다.
// 생성 파일이라 git에 넣지 않는다(.gitignore). dev·build·typecheck·check 전에 이 스크립트가 먼저 돈다
import { writeFileSync } from "node:fs"
import { collectVersions, sectionsFor } from "../../../scripts/changelog.mjs"

const releaseUrl = (version) => `https://github.com/keemtj/hannam-lang/releases/tag/hannam-lang%40${version}`

// MDX가 JSX로 읽지 않도록 코드 밖의 {, <를 이스케이프한다
const escapeMdx = (text) =>
  text
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[{<]/g, (c) => `\\${c}`)))
    .join("")

const out = [
  "---",
  "title: 변경 기록",
  "description: 버전별로 바뀐 내용입니다. 세 패키지는 항상 같은 버전으로 함께 나옵니다.",
  "---",
  "",
  "{/* 이 파일은 apps/site/scripts/gen-changelog.mjs가 각 패키지의 CHANGELOG.md로 만든다. 직접 고치지 않는다 */}",
  "",
  "`hannam-lang`, `@hannam-lang/core`, `@hannam-lang/vite-plugin`은 항상 같은 버전으로 나옵니다. 같은 버전끼리 함께 쓰면 됩니다.",
  "",
]
for (const [version, entries] of collectVersions()) {
  out.push(`## ${version}`, "", `[GitHub 릴리스](${releaseUrl(version)})`, "", ...sectionsFor(entries).map(escapeMdx))
}
writeFileSync(new URL("../content/docs/changelog.mdx", import.meta.url), out.join("\n"))
