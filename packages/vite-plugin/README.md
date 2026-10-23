# @mzscript/vite-plugin

엠지스크립트(`.mz`) 모듈을 Vite에서 쓰게 해 주는 플러그인입니다. `.mz`를 JS로 바꾸고 소스맵을 함께 넘깁니다.

```sh
npm i -D vite @mzscript/vite-plugin
```

Vite 7·8을 지원합니다. Node 20.19 이상 또는 22.12 이상이 필요합니다(Vite 7·8과 같음).

```js
// vite.config.js
import mzscript from "@mzscript/vite-plugin"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [mzscript()],
})
```

```html
<!-- index.html: .mz를 진입점으로 바로 불러옵니다 -->
<script type="module" src="./main.mz"></script>
```

- 브라우저 개발자 도구와 빌드 소스맵이 `.mz` 원본을 가리킵니다.
- 컴파일 에러는 dev 서버의 에러 오버레이와 빌드 로그에 `.mz` 파일·줄·칸과 코드 조각으로 나옵니다.
- 런타임 헬퍼는 플러그인이 직접 연결하므로 앱에 `mzscript`를 따로 설치하지 않아도 됩니다.
- `.mz`끼리는 `import { a } from "./api.mz"`처럼 확장자를 붙여 가져옵니다. 확장자가 없으면 경고를 냅니다.
- `/api` 같은 경로를 프록시할 때는 `"/api/"`처럼 슬래시까지 적습니다. `"/api"`로 쓰면 `/api.mz` 모듈 요청까지 프록시됩니다.

## 옵션

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `runtimeImport` | `"mzscript/runtime"` | 변환 결과가 런타임 헬퍼를 가져올 모듈 이름 |

## 문서

- [Vite로 웹 앱 만들기](https://github.com/keemtj/mzscript/blob/main/apps/site/content/docs/getting-started/vite.mdx)
- [투두 풀스택 만들기](https://github.com/keemtj/mzscript/blob/main/apps/site/content/docs/guides/todo-fullstack.mdx)

## 라이선스

MIT
