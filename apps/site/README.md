# @hannam-lang/site

한남랭 소개·문서 사이트 (Next.js App Router + Fumadocs). 배포하지 않고 로컬 빌드까지만 한다.

```sh
pnpm install
pnpm site:build          # core 빌드 후 사이트 빌드
pnpm site:dev            # 개발 서버
pnpm --filter @hannam-lang/site check   # 문서 코드 검사 + 빌드 결과 확인 (pnpm site:build 먼저)
```

- 문서: `content/docs/**/*.mdx`, 목차는 각 폴더의 `meta.json`
- ```hn 코드 블록은 `packages/vscode/syntaxes/hannam.tmLanguage.json`을 Shiki 언어 `hn`으로 등록해 칠한다 (`lib/hn-grammar.ts`, `source.config.ts`)
- 문서 안 실행 블록: `<TryIt code={"..."} />` (`components/try-it.tsx`). Playground 번들은 `next/dynamic`(ssr: false)로 이 블록과 `/playground`에서만 불러온다
- `scripts/check-docs.mjs`: 문서의 hn 블록·TryIt 코드를 컴파일하고, 바로 뒤의 js 블록과 변환 결과를 비교한다
- `scripts/check-site.mjs`: `next start`를 빈 포트로 띄워 페이지 응답, hn 하이라이팅, 사이트 안 링크, Playground 실행(headless Playwright), 메인 페이지 스크린샷을 확인한다. 인자로 스크린샷 디렉터리를 줄 수 있다
