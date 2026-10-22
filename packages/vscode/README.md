# hannam-lang VS Code 확장

`.hn` 파일에 hannam-lang 문법 하이라이팅, 언어 설정, 스니펫을 제공한다. 배포하지 않는 private 확장이다.

## 제공하는 것

- 언어 `hannam` 등록 (`.hn` 확장자)
- TextMate 문법 `source.hn` (`syntaxes/hannam.tmLanguage.json`)
  - 한남랭 키워드는 각각 별도 scope로 칠한다 (아래 표)
  - 키워드가 아닌 부분은 VS Code 내장 JavaScript 문법(`source.js`)을 include해서 그대로 칠한다
  - 문자열·주석·정규식 안의 키워드 글자는 칠하지 않는다. 템플릿 `${}` 안의 값 위치 키워드(`티~원!`, `예? 무슨 발언이세요?`)만 칠한다
  - 명세의 "가장 긴 형태 우선" 규칙과 공백 경계 규칙을 따른다 (`엄.length`, `엄 = 1`, `엄마`, `아뇨값`은 일반 식별자)
- 언어 설정 (`language-configuration.json`): `//`·`/* */` 주석 토글, 괄호 짝, 자동 닫기, 들여쓰기
- 스니펫 (`snippets/hannam.code-snippets`): `예?`, `예???`, `요이~`, `티-원`, `티~원`, `진~지?` 등. 한남랭 키워드 접두어와 JS 키워드(`if`, `forof`, `function`, `try` …) 둘 다로 부를 수 있다

| 한남랭 | JS | scope |
| --- | --- | --- |
| `엄` / `엄.` / `엄..` | `var` / `let` / `const` | `storage.type.var.hn` / `storage.type.let.hn` / `storage.type.const.hn` |
| `엄...` | `//` 주석 | `comment.line.triple-dot.hn` (키워드 글자는 `punctuation.definition.comment.hn`) |
| `예?` / `예??` / `예???` | `if` / `else if` / `switch` | `keyword.control.conditional.if.hn` / `.else-if.hn` / `.switch.hn` |
| `아뇨아뇨아뇨아뇨` | `else`, `default` | `keyword.control.conditional.else.hn` |
| `요이~` / `요히~` / `요이이이~` | `for...of`·범위 / `for...in` / `while` | `keyword.control.loop.for-of.hn` / `.for-in.hn` / `.while.hn` |
| `줴줴이야` / `아뇨` | `break` / `continue` | `keyword.control.loop.break.hn` / `.continue.hn` |
| `티-원` / `티~원` | `function` / `async function` | `storage.type.function.hn` / `storage.type.function.async.hn` (이름은 `entity.name.function.hn`) |
| `티~원!` | `await` | `keyword.control.flow.await.hn` |
| `아! 줴줴이야~` / `아... 줴줴이야...` | `return` / `throw` | `keyword.control.flow.return.hn` / `.throw.hn` |
| `진~지?` / `지~랄` | `try` / `catch` | `keyword.control.trycatch.try.hn` / `.catch.hn` |
| `오호호호호~` / `오호호호홋~` | `class` / `class extends` | `storage.type.class.hn` / `storage.type.class.extends.hn` (이름은 `entity.name.type.class.hn`, 부모는 `entity.other.inherited-class.hn`) |
| `무슨 발언이세요?` | `console.log` | `support.function.console.log.hn` |
| `예? 무슨 발언이세요?` | `confirm` | `support.function.confirm.hn` |

scope 이름 끝이 `.hn`이라 테마는 앞부분(`keyword.control`, `storage.type` 등)으로 JS 키워드와 같은 색을 입힌다.

### 문법 구조와 한계

- 키워드 규칙은 `injections`로 넣었다. 그래서 `source.js` 규칙 안(블록, 괄호, 화살표 함수 본문 등) 어디서든 끼어들고, `L:` 우선순위 덕분에 같은 위치의 JS 규칙보다 먼저 맞는다.
- TextMate selector로는 "가장 안쪽 scope"를 지정할 수 없다. 그래서 템플릿 `${}` 안의 값 위치 키워드는 템플릿 중첩 깊이 3까지만 칠한다.
- TextMate는 문장 시작 위치를 정확히 알 수 없다. 그래서 문장 키워드는 "앞이 식별자 글자나 `.`가 아님 + 명세의 공백 경계"로 근사해서 칠한다. 컴파일 에러가 나는 위치(예: 값 위치의 `요이~ `)에 써도 칠해질 수 있다.
- 정해진 개수에서 벗어난 형태(`예????`, `아뇨아뇨`, `요이이~` 등)는 칠하지 않는다. 에러 표시는 컴파일러 몫이다.

## 로컬에서 설치해 보기

먼저 레포 루트에서 의존성을 설치한다.

```sh
pnpm install
```

### 방법 1: F5 디버그 실행 (설치 없이)

1. VS Code에서 `packages/vscode` 폴더를 연다 (`code packages/vscode`).
2. `F5`를 누르거나 "실행 및 디버그"에서 **hannam-lang 확장 실행**을 고른다 (`.vscode/launch.json`).
3. 확장이 켜진 새 창(Extension Development Host)이 `examples/todo` 폴더로 열린다. `.hn` 파일을 열면 하이라이팅이 적용된다.
4. 문법을 고친 뒤에는 그 창에서 `Developer: Reload Window`로 다시 불러온다.
5. 토큰 scope는 `Developer: Inspect Editor Tokens and Scopes` 명령으로 확인한다.

### 방법 2: `.vsix` 패키지로 설치

```sh
pnpm --filter hannam-lang-vscode package
# → packages/vscode/dist/hannam-lang-vscode.vsix
code --install-extension packages/vscode/dist/hannam-lang-vscode.vsix
```

- VS Code의 확장 보기에서 `...` 메뉴 → **VSIX에서 설치...**를 골라도 된다.
- 지울 때는 `code --uninstall-extension hannam-lang.hannam-lang-vscode`를 실행한다.
- `package` 스크립트는 `@vscode/vsce`(devDependency)를 쓴다. 라이선스 파일과 저장소 주소가 없는 private 확장이라 `--skip-license --allow-missing-repository`를 붙였고, 런타임 의존성이 없어서 `--no-dependencies`를 붙였다.

## 테스트

```sh
pnpm --filter hannam-lang-vscode test
```

- `vscode-textmate`와 `vscode-oniguruma`로 VS Code와 같은 방식으로 실제 토큰화한다.
- `packages/core/test/fixtures/*.hn`과 `examples/todo/**/*.hn`의 모든 키워드가 기대한 scope를 받는지, 문자열·주석 안의 키워드 글자는 받지 않는지, 코드 위치의 키워드가 JS 색으로 새지 않는지 확인한다. 파일별 키워드 토큰 목록은 스냅샷으로 남긴다.
- JS 문법은 VS Code 1.140.0의 `JavaScript.tmLanguage.json`을 테스트 fixture로 넣어 쓴다 (`test/fixtures/vscode-javascript/`, MIT 라이선스). 실제 VS Code에서는 내장 JavaScript 확장이 `source.js`를 제공하므로 `.vsix`에는 넣지 않는다.
- 토큰을 눈으로 보려면 `node --experimental-strip-types scripts/dump-tokens.ts <파일.hn>`을 실행한다.
