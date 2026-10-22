# hannam-lang

JavaScript를 한남 말투로 쓰는 hannam-lang(`.hn`)의 실행기와 컴파일러입니다. 문법은 [문법 명세](../../docs/hannam-lang-syntax.md)를 보세요.

```sh
npm i -D hannam-lang
```

## 실행: `hannam`
```sh
hannam app.hn [인자...]
```
`.hn`을 메모리에서 JS로 바꿔 바로 실행합니다 (node, tsx 역할). `.hn` 파일끼리 `import "./util.hn"`처럼 확장자를 붙여 import할 수 있고, 에러 스택은 소스맵으로 `.hn` 원본 줄을 가리킵니다. 컴파일 에러는 위치와 코드 조각을 출력하고 종료 코드 1로 끝납니다.

## 컴파일: `hnc`
```sh
hnc src --out-dir dist --source-map
```
`.hn`을 `.js`로 컴파일합니다 (tsc 역할). 기본은 원본 옆에 `.js`를 만들고, 상대 경로 import의 `.hn`은 `.js`로 바뀝니다. 런타임 헬퍼가 필요한 파일은 `hannam-lang/runtime`을 import하므로 출력물을 실행할 프로젝트에 `hannam-lang`을 의존성으로 설치하세요.

## Node 로더 훅
```sh
node --import hannam-lang/register app.hn
```
Node 20.16 이상에서 동작합니다 (로더 훅 `module.register`와, 런타임의 터미널 confirm이 쓰는 `process.getBuiltinModule` 기준).

## Bun
```sh
bun --preload hannam-lang/bun app.hn
```
Node 로더 훅은 Bun에서 동작하지 않으므로 Bun 플러그인을 따로 제공합니다. `bunfig.toml`의 `preload = ["hannam-lang/bun"]`로 등록해도 됩니다.

## API
```js
import { compile, HannamSyntaxError } from "hannam-lang"
const { code, map } = compile(source, { filename: "app.hn" })
```
