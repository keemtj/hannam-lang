# hannam-lang

JavaScript를 한남 말투로 쓰는 한남랭(`.hn`)의 실행기와 컴파일러입니다.

```sh
npm i -D hannam-lang
```

Node 20.16 이상이 필요합니다.

## 명령어

| 명령 | 하는 일 |
| --- | --- |
| `hannam app.hn` | `.hn`을 메모리에서 JS로 바꿔 바로 실행합니다 |
| `hnc app.hn` | `.hn`을 `.js` 파일로 컴파일합니다. `hnc`는 hannam compiler의 줄임말입니다 |

```sh
hnc src --out-dir dist --source-map
```

## 다른 실행 방법

```sh
node --import hannam-lang/register app.hn   # Node 로더 훅
bun --preload hannam-lang/bun app.hn        # Bun 플러그인
```

## 변환기 API

```js
import { compile } from "hannam-lang"

const { code, map, warnings } = compile(source, { filename: "app.hn" })
```

## 문서

- [CLI: hannam과 hnc](https://github.com/keemtj/hannam-lang/blob/main/apps/site/content/docs/getting-started/cli.mdx)
- [문법 레퍼런스](https://github.com/keemtj/hannam-lang/blob/main/apps/site/content/docs/syntax/index.mdx)
- [Bun에서 실행](https://github.com/keemtj/hannam-lang/blob/main/apps/site/content/docs/getting-started/bun.mdx)

## 라이선스

MIT
