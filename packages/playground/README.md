# @hannam-lang/playground

TypeScript Playground처럼 `.hn` 코드를 입력하면 바로 JS로 바꿔 보여 주고, 샌드박스 iframe에서 실행하는 React 컴포넌트다. 문서 사이트(Next.js, Fumadocs)의 `/playground` 페이지와 문서 안 "실행해 보기" 블록에 넣는다.

```tsx
import { Playground } from "@hannam-lang/playground"

// /playground 페이지: 코드를 URL 해시에 저장하고 공유 링크로 복원
<Playground syncUrl height="calc(100vh - 64px)" />

// 문서 안 블록: 공유 링크는 /playground로 보낸다
<Playground initialCode={코드} height={360} showExamples={false} shareBaseUrl="/playground" />
```

| prop | 기본값 | 설명 |
| --- | --- | --- |
| `initialCode` | 첫 번째 예제 | 처음 보여 줄 `.hn` 코드 |
| `height` | `560` | 전체 높이 (숫자는 px) |
| `theme` | `"system"` | `"light"`, `"dark"`, `"system"`. 툴바 버튼으로도 바꿀 수 있다 |
| `syncUrl` | `false` | 코드를 `#code/...` 해시에 저장하고, 해시가 있으면 그 코드로 시작 |
| `shareBaseUrl` | 현재 주소 | 공유 링크의 기준 주소 |
| `showExamples` | `true` | 예제 선택 상자 표시 |
| `loopLimitMs` | `3000` | 반복문 하나가 멈추지 않고 돌 수 있는 시간 |

- 모듈을 불러올 때 `window`에 접근하지 않는다. 에디터와 iframe은 `useEffect` 안에서만 만든다 (SSR 안전)
- 스타일은 컴포넌트가 `<style>`로 직접 넣고, 선택자는 모두 `.hnpg` 아래에 둔다
- `exports`가 TypeScript 소스(`src/index.ts`)를 가리키므로 Next.js에서는 `transpilePackages: ["@hannam-lang/playground"]`가 필요하다

## 실행 방식
- `sandbox="allow-scripts allow-modals"` iframe(`srcdoc`)에서 실행한다. `allow-same-origin`이 없어서 부모 페이지의 쿠키·저장소·DOM에 접근할 수 없고, `allow-modals`로 `예? 무슨 발언이세요?`(confirm) 창을 띄운다
- 변환 결과의 `hannam-lang/runtime` import는 import map으로 data: URL 런타임(`src/sandbox/runtime.ts`)에 연결한다
- 무한 루프는 두 겹으로 막는다
  1. 변환된 JS의 반복문 몸체마다 `__hn_loop()` 호출을 넣어(acorn), 한 번의 동기 실행에서 `loopLimitMs`를 넘기면 에러를 던지고 부모에게 알린다. 부모는 iframe을 없앤다. 확인 창이 떠 있던 시간은 빼고 센다
  2. 최상위 실행이 끝나기 전에 iframe에서 `loopLimitMs + 2초` 동안 아무 신호가 없으면 부모가 iframe을 없앤다 (정규식 폭주처럼 반복문 밖에서 멈춘 경우)

## 개발
```sh
pnpm --filter @hannam-lang/core build   # core dist가 필요하다
pnpm --filter @hannam-lang/playground dev       # http://localhost:5174
pnpm --filter @hannam-lang/playground test
pnpm --filter @hannam-lang/playground build     # 개발용 페이지 빌드 (dist/)
```
