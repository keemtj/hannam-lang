# 한남랭 (hannam-lang) for VS Code

한남랭(`.hn`) 파일을 위한 VS Code 확장입니다. 한남랭은 JavaScript를 한남 말투로 쓰는 방법입니다. `.hn` 파일에 `if` 대신 `예?`, `console.log` 대신 `무슨 발언이세요?`처럼 쓰면 컴파일러가 JavaScript로 바꿔 줍니다.

## 기능

- **문법 하이라이팅**: 한남랭 키워드에 같은 역할의 JS 키워드와 같은 색을 입힙니다. 예를 들어 `예?`는 `if`와, `엄..`은 `const`와 같은 색입니다. 키워드가 아닌 부분은 VS Code 내장 JavaScript 문법으로 칠하고, 문자열·주석 안의 같은 글자는 칠하지 않습니다.
- **컴파일 에러 표시**: 파일을 열거나 고치면 한남랭 컴파일러로 바로 검사해서, 에러는 빨간 밑줄로, 경고는 노란 밑줄로 보여 줍니다. `예????`처럼 형태가 틀린 키워드나 둥근 따옴표가 에러이고, 확장자가 없는 상대 경로 import가 경고입니다. 문제 패널(Problems)에도 같은 내용이 나옵니다.
- **스니펫**: `예?`, `예???`, `요이~`, `티-원`, `티~원`, `진~지?` 등 17개. 한남랭 키워드로도, `if`, `forof`, `function`, `try` 같은 JS 키워드로도 부를 수 있습니다.
- **편집 설정**: `//`·`/* */` 주석 토글, 괄호 짝 맞추기, 자동 닫기, 들여쓰기

자동 완성, 정의로 이동, 코드 서식 맞추기는 아직 없습니다.

## 설치

마켓플레이스에는 올라가 있지 않습니다. 저장소 루트에서 `.vsix`를 만들어 설치합니다.

```sh
pnpm install
pnpm --filter @hannam-lang/core build
pnpm --filter hannam-lang-vscode package
code --install-extension packages/vscode/dist/hannam-lang-vscode.vsix
```

## 쓰는 법

확장을 설치하면 `.hn` 파일에 자동으로 적용됩니다. 따로 설정할 것은 없습니다.

`.hn` 파일을 실행하거나 JavaScript로 컴파일하려면 프로젝트에 `hannam-lang` 패키지를 설치합니다. 확장은 편집만 돕고, 실행은 `hannam`과 `hnc` 명령이 맡습니다.

```sh
npm i -D hannam-lang
npx hannam app.hn        # 바로 실행
npx hnc app.hn           # app.js로 컴파일
```

## 요구 사항

- VS Code 1.90 이상

## 더 보기

- 문법과 사용법: [hannam-lang 저장소](https://github.com/keemtj/hannam-lang)
- 버그 신고와 제안: [이슈](https://github.com/keemtj/hannam-lang/issues)

---

## 개발자용

이 확장은 [hannam-lang 모노레포](https://github.com/keemtj/hannam-lang)의 `packages/vscode`에 있습니다.

- **하이라이팅**: TextMate 문법(`syntaxes/hannam.tmLanguage.json`)이 `source.js` 위에 한남랭 키워드 규칙을 `injections`로 얹습니다. scope 이름은 `keyword.control.conditional.if.hn`처럼 JS와 같은 앞부분에 `.hn`을 붙여서, 테마가 JS 키워드와 같은 색을 입힙니다. TextMate는 문장 시작 위치를 정확히 알 수 없어서, 컴파일 에러가 나는 위치에 쓴 키워드도 칠해질 수 있습니다.
- **에러 표시**: `src/diagnostics.ts`가 `@hannam-lang/core`의 `compile()`로 진단을 계산하고, `src/extension.ts`가 이를 VS Code 진단으로 옮깁니다. 입력이 멈추고 0.25초 뒤에 다시 검사합니다. core는 `dist/extension.cjs`에 함께 번들됩니다.

```sh
pnpm --filter @hannam-lang/core build      # 확장이 번들하는 core를 먼저 빌드
pnpm --filter hannam-lang-vscode test      # 토큰화·진단 테스트
pnpm --filter hannam-lang-vscode package   # dist/hannam-lang-vscode.vsix 생성
code --install-extension packages/vscode/dist/hannam-lang-vscode.vsix
```

토큰 테스트는 `vscode-textmate`와 `vscode-oniguruma`로 VS Code와 같은 방식으로 실제 토큰화합니다. JS 문법은 VS Code 1.140.0의 `JavaScript.tmLanguage.json`(MIT)을 테스트 fixture로 넣어 씁니다. 토큰을 눈으로 보려면 `node --experimental-strip-types scripts/dump-tokens.ts <파일.hn>`을 실행합니다.
