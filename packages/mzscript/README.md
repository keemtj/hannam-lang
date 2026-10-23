# mzscript

말투만 바꿔 쓰는 JavaScript, 엠지스크립트(`.mz`)의 실행기와 컴파일러입니다.

```sh
npm i -D mzscript
```

Node 20.16 이상이 필요합니다.

## 명령어

| 명령 | 하는 일 |
| --- | --- |
| `mz app.mz` | `.mz`를 메모리에서 JS로 바꿔 바로 실행합니다 |
| `mzc app.mz` | `.mz`를 `.js` 파일로 컴파일합니다. `mzc`는 mzscript compiler의 줄임말입니다 |

```sh
mzc src --out-dir dist --source-map
```

## 다른 실행 방법

```sh
node --import mzscript/register app.mz   # Node 로더 훅
bun --preload mzscript/bun app.mz        # Bun 플러그인
```

## 변환기 API

```js
import { compile } from "mzscript"

const { code, map, warnings } = compile(source, { filename: "app.mz" })
```

## 문서

- [CLI: mz와 mzc](https://github.com/keemtj/mzscript/blob/main/apps/site/content/docs/getting-started/cli.mdx)
- [문법 레퍼런스](https://github.com/keemtj/mzscript/blob/main/apps/site/content/docs/syntax/index.mdx)
- [Bun에서 실행](https://github.com/keemtj/mzscript/blob/main/apps/site/content/docs/getting-started/bun.mdx)

## 라이선스

MIT
