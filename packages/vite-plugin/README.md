# @hannam-lang/vite-plugin

한남랭(`.hn`) 모듈을 Vite에서 쓰게 해 주는 플러그인입니다. `.hn`을 JS로 바꾸고 소스맵을 함께 넘깁니다.

```sh
npm i -D vite @hannam-lang/vite-plugin
```

Vite 7·8을 지원합니다. Node 20.19 이상 또는 22.12 이상이 필요합니다(Vite 7·8과 같음).

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

- 브라우저 개발자 도구와 빌드 소스맵이 `.hn` 원본을 가리킵니다.
- 컴파일 에러는 dev 서버의 에러 오버레이와 빌드 로그에 `.hn` 파일·줄·칸과 코드 조각으로 나옵니다.
- 런타임 헬퍼는 플러그인이 직접 연결하므로 앱에 `hannam-lang`을 따로 설치하지 않아도 됩니다.
- `.hn`끼리는 `import { a } from "./api.hn"`처럼 확장자를 붙여 가져옵니다. 확장자가 없으면 경고를 냅니다.
- `/api` 같은 경로를 프록시할 때는 `"/api/"`처럼 슬래시까지 적습니다. `"/api"`로 쓰면 `/api.hn` 모듈 요청까지 프록시됩니다.

## 옵션

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `runtimeImport` | `"hannam-lang/runtime"` | 변환 결과가 런타임 헬퍼를 가져올 모듈 이름 |

## 문서

- [Vite로 웹 앱 만들기](https://github.com/keemtj/hannam-lang/blob/main/apps/site/content/docs/getting-started/vite.mdx)
- [투두 풀스택 만들기](https://github.com/keemtj/hannam-lang/blob/main/apps/site/content/docs/guides/todo-fullstack.mdx)

## 라이선스

MIT
