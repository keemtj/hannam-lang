# @hannam-lang/vite-plugin

hannam-lang(`.hn`) 모듈을 Vite에서 쓰게 해 주는 플러그인이다. `.hn`을 `@hannam-lang/core`의 `compile()`로 JS로 바꾸고 소스맵을 함께 넘긴다.

## 지원 버전
- Vite `^7.0.0 || ^8.0.0` (peerDependency). 테스트는 Vite 8.3.3으로 돌린다
- Node `^20.19.0 || >=22.12.0` (Vite 7·8과 같음)

## 사용법

```js
// vite.config.js
import hannam from "@hannam-lang/vite-plugin"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [hannam()],
})
```

```html
<!-- index.html: .hn을 진입점으로 바로 불러올 수 있다 -->
<script type="module" src="./main.hn"></script>
```

`.hn` 안에서는 다른 `.hn`을 확장자까지 적어 가져온다 (`import { a } from "./api.hn"`). 확장자 없는 상대 import는 컴파일 에러다.

## 하는 일
- **변환**: `.hn`(쿼리가 붙은 요청 포함)을 JS로 바꾸고 소스맵을 돌려준다. 브라우저 개발자 도구와 빌드 소스맵이 `.hn` 원본을 가리킨다
- **런타임 연결**: 변환 결과가 런타임 헬퍼를 쓰면 `import { __hn } from "hannam-lang/runtime"`이 붙는다. 플러그인이 이 이름을 자기 의존성인 `@hannam-lang/core/runtime`의 실제 파일로 풀어 주므로, 앱에 런타임 패키지를 따로 설치할 필요가 없다 (pnpm의 엄격한 node_modules 구조에서도 동작)
- **에러 표시**: 컴파일 에러를 Rollup 에러 형식(`id`, `loc`, `frame`)으로 넘긴다. dev 서버의 에러 오버레이와 빌드 로그에 `.hn` 파일·줄·칸과 코드 조각이 나온다. `loc.column`은 Rollup 관례대로 0부터 센다 (메시지 안의 `파일:줄:칸`은 1부터)
- **갱신**: `.hn`을 고치면 Vite의 기본 동작대로 해당 모듈을 다시 변환하고, HMR 경계가 없으면 페이지를 새로 고친다

## 옵션

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `runtimeImport` | `"hannam-lang/runtime"` | 변환 결과가 런타임을 가져올 모듈 이름. 플러그인은 이 이름을 core 런타임 파일로 푼다 |

## 예제: 투두 웹 화면
`examples/todo/web`을 이 플러그인으로 띄울 수 있다. `/api/` 요청은 `TODO_API_PORT`(기본값 3100) 포트의 투두 서버로 프록시한다.

```sh
pnpm install
pnpm --filter @hannam-lang/core --filter @hannam-lang/vite-plugin build
TODO_API_PORT=3100 pnpm --filter @hannam-lang/example-todo-web dev   # 개발 서버
pnpm --filter @hannam-lang/example-todo-web build                    # 정적 빌드 (dist/)
```

투두 서버(`examples/todo/server/server.hn`)는 포트가 3000으로 고정돼 있다. 다른 포트로 띄우려면 복사본의 `포트` 값을 바꾸고 core의 `compile()`로 변환해 node로 실행한다.

## 알려진 동작
- dev 서버는 HTML의 `<script src="./main.hn">` 요청을 브라우저가 붙이는 `Sec-Fetch-Dest: script` 헤더로 알아보고 변환한다. 이 헤더를 보내지 않는 오래된 브라우저에서는 진입점이 변환되지 않는다
- `/api` 같은 접두어 프록시를 쓸 때는 `"/api/"`처럼 슬래시까지 적는다. `"/api"`는 `/api.hn` 모듈 요청까지 프록시해 버린다
