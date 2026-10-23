# @mzscript/core

엠지스크립트(`.mz`)를 JavaScript로 바꾸는 변환기입니다. 빌드 도구나 에디터 기능을 직접 만들 때 씁니다. 명령어로 실행하거나 컴파일하려면 [`mzscript`](https://www.npmjs.com/package/mzscript)을 쓰세요.

```sh
npm i @mzscript/core
```

```js
import { compile, MzScriptSyntaxError } from "@mzscript/core"

try {
  const { code, map, warnings } = compile(source, { filename: "app.mz" })
} catch (e) {
  if (e instanceof MzScriptSyntaxError) console.error(e.message) // 파일:줄:칸과 코드 조각 포함
}
```

| 옵션 | 설명 |
| --- | --- |
| `filename` | 에러 메시지와 소스맵에 쓸 파일 이름 |
| `rewriteImports` | 상대 경로 import의 `.mz`를 `.js`로 바꿉니다 |
| `runtimeImport` | 런타임 헬퍼를 가져올 모듈 이름 (기본값 `"mzscript/runtime"`) |

결과의 `warnings`에는 변환은 했지만 알려야 하는 내용(예: 확장자가 없는 상대 경로 import)이 담깁니다.

구조는 [컴파일러 구조](https://github.com/keemtj/mzscript/blob/main/apps/site/content/docs/compiler.mdx) 문서에 있습니다.

## 라이선스

MIT
