# hannam-lang

**그냥 JavaScript입니다. 말투만 한남입니다.** `.hn`에 한남 말투로 쓰고 JS로 바꿔서 브라우저와 Node 양쪽에서 실행합니다.

[![npm](https://img.shields.io/npm/v/hannam-lang?label=npm)](https://www.npmjs.com/package/hannam-lang)

한남랭은 새 언어가 아니라 JavaScript를 쓰는 말투입니다. 문장 맨 앞의 키워드만 JS로 바꾸고 나머지는 그대로 두기 때문에, ES2015+ 문법, DOM, `fetch`, Node API, npm 패키지를 그대로 씁니다. 읽기에는 낯설어도 실제 웹 개발에 쓸 수 있는 수준을 목표로 합니다. 서버와 화면을 모두 `.hn`으로 짠 [투두 풀스택 예제](examples/todo/)가 그 증거입니다.

```hn
엄... 할 일 목록에서 남은 일만 출력한다
티~원 불러오기() {
  아! 줴줴이야~ [
    { 내용: "우유 사기", 완료: true },
    { 내용: "README 쓰기", 완료: false },
    { 내용: "운동", 완료: false },
  ]
}

진~지? {
  엄.. 할일들 = 티~원! 불러오기()
  요이~ 할일 할일들 {
    예? 할일.완료 {
      아뇨
    }
    무슨 발언이세요? `□ ${할일.내용}`
  }
} 지~랄 e {
  무슨 발언이세요? "불러오기 실패:", e.message
}
```

`hnc`로 바꾸면 이런 JS가 나옵니다. 줄 번호가 원본과 같아서 스택 트레이스를 그대로 읽을 수 있습니다.

```js
// 할 일 목록에서 남은 일만 출력한다
async function 불러오기() {
  return [
    { 내용: "우유 사기", 완료: true },
    { 내용: "README 쓰기", 완료: false },
    { 내용: "운동", 완료: false },
  ]
}

try {
  const 할일들 = await 불러오기()
  for (const 할일 of 할일들) {
    if (할일.완료) {
      continue
    }
    console.log(`□ ${할일.내용}`)
  }
} catch (e) {
  console.log("불러오기 실패:", e.message)
}
```

```console
$ hannam todo.hn
□ README 쓰기
□ 운동
```

## 키워드

문장 맨 앞에 오는 키워드만 한남 말투로 바꿉니다. 연산자, 화살표 함수, `new`, `typeof`, `import`/`export` 같은 나머지 문법과 플랫폼 API는 JS 그대로 씁니다. 자세한 규칙은 [문법 명세](docs/hannam-lang-syntax.md)를 보세요.

| 한남랭 | JS |
| --- | --- |
| `엄` / `엄.` / `엄..` / `엄...` | `var` / `let` / `const` / `// 주석` |
| `예? 조건 {` / `} 예?? 조건 {` / `예??? 값 {` | `if` / `else if` / `switch` (if-else 체인으로 변환) |
| `} 아뇨아뇨아뇨아뇨 {` / `아뇨` | `else`·`default` / `continue` |
| `요이~ 항목 목록 {` / `요이~ i 0..10 {` / `요이이이~ 조건 {` | `for...of` / 범위 `for` (끝 미포함) / `while` |
| `요히~ 키 객체 {` | `for...in` |
| `줴줴이야` / `아! 줴줴이야~ 값` / `아... 줴줴이야... 값` | `break` / `return` / `throw` (문자열이면 `new Error`로 감쌈) |
| `티-원 이름() {` / `티~원 이름() {` / `티~원! 표현식` | `function` / `async function` / `await` |
| `진~지? {` | `try` |
| `} 지~랄 e {` | `catch (e)` |
| `오호호호호~ 이름 {` / `오호호호홋~ 이름 부모 {` | `class` / `class extends` |
| `무슨 발언이세요? 값` / `예? 무슨 발언이세요?(질문)` | `console.log(값)` / `confirm(질문)` |

- 블록은 JS처럼 `{ }`를 쓰고, 조건 괄호와 세미콜론은 생략할 수 있습니다.
- 키워드의 형태는 고정입니다. `예????`, `아뇨아뇨`, `요이이~`처럼 정해진 개수에서 벗어나면 JS로 넘기지 않고 컴파일 에러를 냅니다.
- 문자열·주석·정규식 안의 키워드 글자는 바꾸지 않습니다.

## 설치

프로젝트 의존성으로 설치합니다. Node 20.16 이상이 필요합니다.

```sh
npm i -D hannam-lang
pnpm add -D hannam-lang
yarn add -D hannam-lang
bun add -d hannam-lang
```

처음 설치하면 그 시점의 최신 버전이 깔리고, `package.json`에는 `^0.1.0` 같은 범위가 기록됩니다. 이미 설치한 프로젝트를 최신 버전으로 올릴 때는 `npm i -D hannam-lang@latest`처럼 `@latest`를 붙입니다.

전역 설치:

```sh
npm i -g hannam-lang
pnpm add -g hannam-lang
yarn global add hannam-lang
bun add -g hannam-lang
```

설치 없이 한 번 실행 (패키지 이름과 명령 이름이 달라서 `-p`로 패키지를 지정합니다. 설치 없이 실행할 때는 `@latest`를 붙여 항상 최신 버전을 받게 합니다):

```sh
npx -p hannam-lang@latest hannam app.hn
bunx -p hannam-lang@latest hannam app.hn
```

저장소를 받아 개발 버전을 직접 빌드해 쓰는 방법은 [CONTRIBUTING.md](CONTRIBUTING.md#개발-버전-실행하기)에 있습니다.

## 빠른 시작

`hello.hn`을 만듭니다.

```hn
엄.. 이름 = "한남랭"
무슨 발언이세요? `안녕, ${이름}`
```

```sh
hannam hello.hn                      # 바로 실행 (node, tsx 역할)
hnc hello.hn                         # hello.js 생성 (tsc 역할)
hnc src --out-dir dist --source-map  # 디렉터리 전체를 dist/로, 소스맵 포함
```

- `hnc`는 hannam compiler의 줄임말입니다. TypeScript의 `tsc`(TypeScript compiler)와 같은 방식으로 지은 이름입니다.
- `hannam`은 `.hn`을 메모리에서 JS로 바꿔 실행합니다. 에러 스택은 소스맵으로 `.hn` 원본 줄을 가리킵니다.
- `.hn` 파일끼리는 `import { 할일추가 } from "./store.hn"`처럼 확장자를 붙여 가져옵니다. `hnc`는 이 경로를 `./store.js`로 바꿔 출력합니다. 확장자 없는 상대 경로 import는 그대로 두고 경고만 냅니다.
- 컴파일 에러는 파일·줄·칸과 코드 조각을 보여 주고 종료 코드 1로 끝납니다.
- `hnc` 출력물 중 런타임 헬퍼가 필요한 파일은 `hannam-lang/runtime`을 import합니다. 출력물을 실행할 프로젝트에 `hannam-lang`을 의존성으로 설치하세요.
- Node 로더 훅으로도 실행할 수 있습니다: `node --import hannam-lang/register app.hn`

자세한 내용은 [`packages/hannam-lang`](packages/hannam-lang/README.md)을 보세요.

## Vite에서 쓰기

```sh
npm i -D vite @hannam-lang/vite-plugin
```

```js
// vite.config.js
import hannam from "@hannam-lang/vite-plugin"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [hannam()],
})
```

```html
<!-- index.html: .hn을 진입점으로 바로 불러옵니다 -->
<script type="module" src="./main.hn"></script>
```

Vite 7·8을 지원합니다. 소스맵이 `.hn` 원본을 가리키고, 컴파일 에러는 dev 서버의 에러 오버레이에 `.hn` 위치와 함께 나옵니다. 자세한 내용은 [`packages/vite-plugin`](packages/vite-plugin/README.md)을 보세요.

## Bun

Node 로더 훅은 Bun에서 동작하지 않으므로 Bun 플러그인을 따로 제공합니다.

```sh
bun --preload hannam-lang/bun app.hn
```

`bunfig.toml`에 `preload = ["hannam-lang/bun"]`를 적어 두면 `bun app.hn`만으로 실행됩니다.

## VS Code 확장

[`packages/vscode`](packages/vscode/README.md)에 `.hn` 문법 하이라이팅, 주석·괄호 설정, 스니펫이 있습니다. 마켓플레이스에는 올리지 않았고, 로컬에서 `.vsix`로 만들어 설치합니다.

```sh
pnpm --filter hannam-lang-vscode package
code --install-extension packages/vscode/dist/hannam-lang-vscode.vsix
```

## Playground와 문서 사이트

`.hn`을 입력하면 바로 JS로 바꿔 보여 주고 샌드박스 iframe에서 실행하는 Playground가 있습니다. 레포에서 띄워 볼 수 있습니다.

```sh
pnpm install
pnpm --filter @hannam-lang/core build
pnpm --filter @hannam-lang/playground dev   # http://localhost:5174
pnpm site:dev                               # 문서 사이트 (apps/site)
```

## 투두 데모

서버(`hannam`)와 화면(Vite)을 모두 `.hn`으로 짠 할 일 앱입니다. 추가, 완료 토글, 필터, 확인 창을 거친 삭제를 합니다.

```sh
pnpm install
pnpm demo        # 서버(기본 포트 3100)와 Vite 개발 서버를 함께 띄움
```

실행 방법, API, 코드에서 눈여겨볼 문법은 [`examples/todo`](examples/todo/README.md)에 있습니다.

## 모노레포 구조

pnpm 워크스페이스입니다.

```
packages/
  core/          @hannam-lang/core         변환기 (compile, 소스맵, 런타임 헬퍼)
  hannam-lang/   hannam-lang               CLI hannam·hnc, Node 로더 훅, Bun 플러그인
  vite-plugin/   @hannam-lang/vite-plugin  Vite 플러그인
  vscode/        hannam-lang-vscode        VS Code 확장 (private)
  playground/    @hannam-lang/playground   Playground React 컴포넌트 (private)
apps/
  site/          문서 사이트
examples/
  todo/          투두 풀스택 예제 (서버·화면 모두 .hn)
docs/            문법 명세와 프로젝트 맥락
scripts/         설치 매트릭스 등 저장소 관리 스크립트
```

변환기는 다른 도구에서도 쓸 수 있습니다.

```js
import { compile, HannamSyntaxError } from "@hannam-lang/core"

const { code, map } = compile(source, { filename: "app.hn" })
```

## 기여하기

개발 환경, 테스트, changeset, 커밋·PR 규칙, 새 키워드를 제안하는 기준은 [CONTRIBUTING.md](CONTRIBUTING.md)에 있습니다. 문법이 맞는지 판단하는 기준은 [문법 명세](docs/hannam-lang-syntax.md)이고, 만든 이유와 기각한 안은 [프로젝트 맥락](docs/hannam-lang-context.md)에 정리했습니다.

```sh
pnpm install
pnpm -r build
pnpm -r test
```

## 라이선스

[MIT](LICENSE)
