# 투두 풀스택 예제

서버와 화면을 모두 `.mz`로 짠 할 일 앱입니다. mzscript가 장난감이 아니라 실제 웹 개발에 쓸 수 있는지 보여 주는 데모입니다.

- **서버**: `node:http`로 만든 REST API. 할 일을 `server/todos.json`에 저장합니다. `mz`로 바로 실행합니다.
- **화면**: 추가, 완료 토글, 필터(전체·완료·남음), 확인 창을 거친 삭제. Vite와 `@mzscript/vite-plugin`으로 띄우고, `index.html`이 `main.mz`를 직접 불러옵니다.
- 프레임워크 없이 `fetch`와 DOM API만 씁니다. 플랫폼 API는 JS 이름 그대로 쓰는 것이 mzscript의 원칙입니다.

```
server/server.mz   node:http REST 서버, JSON 파일 저장
web/api.mz         fetch로 서버 API 호출
web/main.mz        화면: 추가, 완료 토글, 삭제(confirm), 필터
web/index.html     <script type="module" src="./main.mz">
web/vite.config.js Vite 설정. /api/ 요청을 서버로 프록시
demo.js            서버와 웹을 함께 띄우는 스크립트 (pnpm demo)
```

## 실행

레포 루트에서 실행합니다.

```sh
pnpm install
pnpm demo
```

`pnpm demo`는 core와 Vite 플러그인을 빌드한 뒤 서버(기본 포트 3100)와 Vite 개발 서버를 함께 띄웁니다. 터미널에 나온 Vite 주소(보통 `http://localhost:5173`)를 브라우저로 엽니다. `Ctrl+C`를 누르면 둘 다 끝납니다.

서버 포트를 바꾸려면 `PORT`를 줍니다. 웹의 프록시도 같은 포트를 바라봅니다.

```sh
PORT=4000 pnpm demo
```

### 서버와 웹을 따로 띄우기

```sh
pnpm demo:build                          # core, vite-plugin 빌드 (처음 한 번)
PORT=3100 pnpm demo:server               # 터미널 1: mz로 서버 실행
TODO_API_PORT=3100 pnpm demo:web         # 터미널 2: Vite 개발 서버
```

- `demo:server`는 `mz examples/todo/server/server.mz`와 같습니다. `.mz`를 메모리에서 JS로 바꿔 바로 실행합니다.
- 서버 포트는 `PORT` 환경변수(기본값 3100), 웹 프록시가 바라보는 포트는 `TODO_API_PORT`(기본값 3100)입니다. 둘을 다르게 줬다면 화면에서 API 요청이 실패합니다.
- 저장 파일 `server/todos.json`은 git에 올리지 않습니다. 지우면 빈 목록으로 다시 시작합니다.

정적 빌드는 `pnpm --filter @mzscript/example-todo-web build`로 만듭니다 (`web/dist/`). 서버는 정적 파일을 서빙하지 않고 빌드 결과에는 `/api/` 프록시가 없으므로, 배포할 때는 `/api/` 요청을 서버로 넘겨 주는 설정이 따로 필요합니다.

## API

| 메서드 | 경로 | 동작 | 응답 |
| --- | --- | --- | --- |
| GET | `/api/todos` | 목록 | 200, 할 일 배열 |
| POST | `/api/todos` | 추가. 본문 `{ "내용": "..." }` | 201, 새 할 일. 빈 내용은 400 |
| PATCH | `/api/todos/:id` | 완료 토글 | 200, 바뀐 할 일. 없는 id는 404 |
| DELETE | `/api/todos/:id` | 삭제 | 204. 없는 id는 404 |

할 일 하나는 `{ "id": 1792641444068, "내용": "우유 사기", "완료": false }` 모양입니다. 지원하지 않는 메서드는 405, 없는 경로는 404, 서버 안에서 난 예외는 500으로 응답합니다.

## 코드에서 눈여겨볼 문법

| 위치 | 엠지스크립트 | 무엇을 보여 주는가 |
| --- | --- | --- |
| `server.mz` 요청 처리 | `예??? req.method {` + `"GET" {` … `아뇨아뇨아뇨아뇨 {` | `switch` 대신 쓰는 갈래. if-else 체인으로 변환되므로 갈래 안의 `아! 줴줴이야~`가 바로 함수를 끝냅니다 |
| `server.mz` 경로 분기 | `예? … {` `} 예?? id !== null {` | `if` / `else if` |
| `server.mz` `불러오기()` | `진~지? {` `} 지~랄 에러 {` `아... 줴줴이야... 에러` | `try`/`catch`. 처리하지 못한 에러는 다시 던집니다 (타입을 모르는 값이라 `__mz.toError`로 감쌈) |
| `server.mz`, `api.mz` | `티~원 이름() {`, `티~원! 표현식` | `async function`과 `await`. `main.mz` 맨 아래에서는 `티~원!`을 함수 밖에서 씁니다 (ESM의 top-level await) |
| `api.mz` `요청()` | `` 아... 줴줴이야... `요청 실패 (${응답.status})` `` | 문자열을 던지면 `throw new Error(...)`로 바뀝니다 |
| `main.mz` `보이는할일()` | `"전체" { 아! 줴줴이야~ 할일들 }` | 한 줄 블록. return 값이 같은 줄의 `}` 앞에서 끝납니다 |
| `main.mz` 삭제 버튼 | `예? 예? 무슨 발언이세요?("이 할 일을 지울까요?") {` | `confirm`을 조건으로 쓰는 형태. 앞의 `예?`가 `if`, 뒤의 `예? 무슨 발언이세요?(...)`가 `confirm(...)`입니다 |
| `main.mz` 에러 처리 | `무슨 발언이세요? "추가 실패:", 에러.message` | `console.log`. 쉼표로 여러 값을 찍습니다 |
| `main.mz` 필터 버튼 | `요이~ 버튼 필터버튼들 {` | `for (const 버튼 of 필터버튼들)` |
| 세 파일 모두 | `엄.. 이름 =`, `엄. 이름 =`, `엄... 주석` | `const`, `let`, 줄 주석 |

변환 결과는 `packages/core/test/__snapshots__/todo/`에 스냅샷으로 있습니다. core 테스트가 이 세 파일을 변환해 스냅샷과 비교합니다.

## 만들며 정한 것

이 예제는 변환기보다 먼저, 문법 명세만 보고 쓴 초안에서 출발했습니다. 그때 발견한 점이 명세에 반영됐습니다.

- **async 화살표 함수와 `for await`는 JS 그대로.** 이벤트 리스너와 `http.createServer` 콜백의 `async (e) => {`, 요청 본문을 읽는 `for await`가 그렇습니다. 화살표 함수 설탕은 다음 버전 후보입니다.
- **한 줄 블록 규칙.** `{ 아! 줴줴이야~ 할일들 }`처럼 쓰려면 return 값이 같은 줄의 `}` 앞에서 끝나야 합니다.
- **변환기는 열린 블록의 종류를 추적합니다.** `예???` 안의 `"GET" {`(갈래)와 일반 블록, `}` 뒤의 `아뇨아뇨아뇨아뇨`(else)와 `예???` 안의 `아뇨아뇨아뇨아뇨`(default)를 구분하기 위해서입니다.
- **Vite 플러그인은 HTML의 `.mz` 진입점을 처리합니다.** `index.html`이 `main.mz`를 직접 불러옵니다.
