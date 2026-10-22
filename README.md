<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark.svg" />
    <img src="./assets/logo-light.svg" alt="한남랭" height="72" />
  </picture>
  <p><strong>그냥 JavaScript입니다. 말투만 한남입니다.</strong></p>
  <p>
    <a href="https://www.npmjs.com/package/hannam-lang"><img src="https://img.shields.io/npm/v/hannam-lang.svg?style=flat-square&colorA=000&colorB=000" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/hannam-lang"><img src="https://img.shields.io/npm/dm/hannam-lang.svg?style=flat-square&colorA=000&colorB=000" alt="npm downloads" /></a>
    <a href="https://github.com/keemtj/hannam-lang"><img src="https://img.shields.io/github/stars/keemtj/hannam-lang?style=flat-square&colorA=000&colorB=000" alt="GitHub stars" /></a>
    <a href="https://github.com/keemtj/hannam-lang/blob/main/LICENSE"><img src="https://img.shields.io/github/license/keemtj/hannam-lang?style=flat-square&colorA=000&colorB=000" alt="MIT License" /></a>
  </p>
  <p>한국어 | <a href="./README.en.md">English</a></p>
</div>

## 한남랭이란?

한남랭(hannam-lang)은 새 언어가 아니라 JavaScript를 한남 말투로 쓰는 방법입니다. `.hn` 파일에 `if` 대신 `예?`, `console.log` 대신 `무슨 발언이세요?`처럼 쓰면 컴파일러가 JavaScript로 바꿉니다. 바뀌는 것은 문장 맨 앞의 키워드뿐이고, 나머지 문법과 DOM, `fetch`, Node API, npm 패키지는 JS 그대로 씁니다. 출력은 ES 모듈이라 브라우저, Node, Bun에서 실행됩니다.

## 예시

```hn title="todo.hn"
티~원 불러오기() {
  아! 줴줴이야~ [
    { 내용: "우유 사기", 완료: true },
    { 내용: "README 쓰기", 완료: false },
  ]
}

요이~ 할일 티~원! 불러오기() {
  예? 할일.완료 {
    아뇨
  }
  무슨 발언이세요? `□ ${할일.내용}`
}
```

```js title="todo.js"
async function 불러오기() {
  return [
    { 내용: "우유 사기", 완료: true },
    { 내용: "README 쓰기", 완료: false },
  ]
}

for (const 할일 of await 불러오기()) {
  if (할일.완료) {
    continue
  }
  console.log(`□ ${할일.내용}`)
}
```

| 한남랭 | JavaScript |
| --- | --- |
| `엄` / `엄.` / `엄..` / `엄...` | `var` / `let` / `const` / `// 주석` |
| `예?` / `예??` / `예???` | `if` / `else if` / `switch` |
| `아뇨아뇨아뇨아뇨` | `else`, `default` |
| `요이~` / `요이이이~` | `for...of`·범위 반복 / `while` |
| `요히~` | `for...in` |
| `줴줴이야` / `아뇨` | `break` / `continue` |
| `아! 줴줴이야~` / `아... 줴줴이야...` | `return` / `throw` |
| `티-원` / `티~원` / `티~원!` | `function` / `async function` / `await` |
| `진~지?` / `지~랄` | `try` / `catch` |
| `오호호호호~` / `오호호호홋~` | `class` / `class extends` |
| `무슨 발언이세요? 값` / `예? 무슨 발언이세요?(질문)` | `console.log` / `confirm` |

## 빠른 시작

Node 20.16 이상이 필요합니다.

```sh
npm i -D hannam-lang
```

```sh
npx hannam todo.hn   # 바로 실행
npx hnc todo.hn      # todo.js로 컴파일
```

`hannam`은 `.hn`을 바로 실행하는 실행기이고, `hnc`(hannam compiler)는 `.js` 파일을 만드는 컴파일러입니다. pnpm, yarn, bun으로 설치하는 방법은 [설치 문서](apps/site/content/docs/getting-started/installation.mdx)에 있습니다.

## 패키지

| 패키지 | 하는 일 |
| --- | --- |
| [`hannam-lang`](packages/hannam-lang) | 실행기 `hannam`, 컴파일러 `hnc`, Node 로더 훅, Bun 플러그인 |
| [`@hannam-lang/vite-plugin`](packages/vite-plugin) | Vite에서 `.hn`을 바로 import합니다 |
| [`@hannam-lang/core`](packages/core) | 변환기 API(`compile`). 빌드 도구를 직접 만들 때 씁니다 |
| [VS Code 확장](packages/vscode) | 문법 하이라이팅, 스니펫, 컴파일 에러 표시 |

## 동작 방식

1. 렉서가 문자열, 템플릿 리터럴, 주석, 정규식을 구분해 JS 토큰의 경계를 나눕니다.
2. 변환기가 괄호와 블록을 따라가며 문장이 시작하는 위치를 찾고, 그 자리의 한남랭 키워드만 JS로 바꿉니다.
3. 구문 트리를 다시 출력하지 않고 원문에서 키워드 자리만 고칩니다. 그래서 줄 번호와 주석이 그대로 남고, 소스맵이 `.hn` 원본을 가리킵니다.
4. 키워드가 없는 JS는 한 글자도 바뀌지 않습니다. 고정 버전 npm 패키지의 JS 파일 648개로 이 성질을 테스트합니다.

자세한 내용은 [컴파일러 구조](apps/site/content/docs/compiler.mdx)에 있습니다.

## 문서

- [한남랭 소개](apps/site/content/docs/index.mdx)
- [문법 레퍼런스](apps/site/content/docs/syntax/index.mdx)
- [투두 풀스택 만들기](apps/site/content/docs/guides/todo-fullstack.mdx): 서버와 화면을 모두 `.hn`으로 짠 예제([`examples/todo`](examples/todo))
- [JS에서 옮겨 오기](apps/site/content/docs/guides/from-javascript.mdx)

## 개발

```sh
pnpm install
pnpm build
pnpm test
```

개발 환경, 커밋 규칙, 새 키워드를 제안하는 기준은 [CONTRIBUTING.md](CONTRIBUTING.md)에 있습니다.

## 릴리스

패키지에 영향을 주는 변경에는 changeset을 추가합니다.

```sh
pnpm changeset
```

`main`에 병합되면 버전 PR이 만들어지거나 갱신됩니다. 버전 PR을 병합하면 npm 패키지와 VS Code 확장(VS Code 마켓플레이스, Open VSX)이 배포됩니다. 처음 한 번 필요한 저장소 설정은 [RELEASING.md](.github/RELEASING.md)에 있습니다.

## 라이선스

[MIT](LICENSE)
