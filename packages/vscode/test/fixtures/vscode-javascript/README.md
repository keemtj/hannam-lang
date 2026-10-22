# VS Code 내장 JavaScript 문법 (테스트 fixture)

`JavaScript.tmLanguage.json`은 [microsoft/vscode](https://github.com/microsoft/vscode)의
`extensions/javascript/syntaxes/JavaScript.tmLanguage.json`을 수정 없이 복사한 파일이다.

- 출처 태그: `1.140.0` (커밋 `07f806f999227108933c2e30515b26eecc1fda74`)
- 라이선스: MIT, 원문은 같은 폴더의 `LICENSE.txt` (Copyright (c) 2015 - present Microsoft Corporation)
- 원본은 [TypeScript-TmLanguage](https://github.com/microsoft/TypeScript-TmLanguage)에서 변환된 것이다 (파일 안 `version` 필드 참고)

실제 VS Code에서는 내장 JavaScript 확장이 `source.js`를 제공하므로, 이 파일은 테스트에서
`vscode-textmate`로 토큰화할 때만 쓰고 `.vsix`에는 넣지 않는다.
