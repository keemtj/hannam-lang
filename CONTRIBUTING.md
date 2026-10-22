# 기여 안내

hannam-lang에 관심 가져 줘서 고마워요. 이 문서는 개발 환경, 테스트, changeset, 커밋·PR 규칙, 새 밈 제안 기준을 다룹니다.

먼저 읽으면 좋은 문서:

- `docs/hannam-lang-syntax.md`: 문법 명세. 변환 결과가 맞는지 판단하는 기준입니다.
- `docs/hannam-lang-context.md`: 프로젝트를 만든 이유, 주요 결정과 기각한 안, 로드맵.

## 개발 환경

- Node.js 22 (CI는 20, 22, 24에서 돌립니다)
- pnpm 10. 버전은 루트 `package.json`의 `packageManager`에 고정돼 있어서 `corepack enable`을 한 번 해 두면 같은 버전을 씁니다.

```sh
corepack enable
pnpm install
pnpm -r build
```

### 저장소 구조

```
packages/
  core/          # 변환기 @hannam-lang/core (렉서, JS 출력, 소스맵, 런타임 헬퍼)
  ...            # CLI, Vite 플러그인 등은 패키지가 생기는 대로 여기에 추가
examples/
  todo/          # 명세만으로 쓴 투두 풀스택 예제 (.hn)
docs/            # 문법 명세와 프로젝트 맥락
scripts/         # 저장소 관리용 스크립트
```

## 테스트

```sh
pnpm -r build       # 빌드
pnpm -r typecheck   # 타입 검사
pnpm -r test        # 테스트 (vitest)
```

CI(`.github/workflows/ci.yml`)도 이 세 명령을 같은 순서로 ubuntu·macOS·Windows × Node 20·22·24에서 실행합니다. 특정 패키지만 돌리려면 `pnpm --filter @hannam-lang/core test`처럼 씁니다.

- **변환 결과는 `.hn` ↔ `.js` 짝으로 테스트합니다.** `packages/core/test/fixtures/`에 같은 이름의 `.hn`과 기대하는 `.js`를 나란히 둡니다. 명세의 예제가 곧 테스트 케이스입니다.
- 버그를 고칠 때는 먼저 그 버그를 재현하는 테스트를 추가하고, 그 테스트가 통과하도록 고칩니다.
- `test.skip`, `.only`, 비어 있는 테스트는 커밋하지 않습니다.
- 스냅샷을 갱신(`vitest -u`)했다면 바뀐 내용이 의도한 것인지 diff로 확인하고, PR 설명에 이유를 적어 주세요.

### 설치 매트릭스

CLI 패키지(`packages/hannam-lang`)를 npm, pnpm, yarn, bun으로 전역 설치해 보는 스크립트가 있습니다. 로컬 임시 레지스트리를 쓰고 실제 npm이나 전역 디렉터리는 건드리지 않습니다.

```sh
bash scripts/install-matrix.sh            # 4종 모두
bash scripts/install-matrix.sh npm bun    # 고른 것만
```

## changeset 작성법

공개 패키지의 버전과 CHANGELOG는 [changesets](https://changesets.dev)로 관리합니다. 사용자에게 보이는 변경을 했다면 PR에 changeset을 하나 넣어 주세요.

```sh
pnpm changeset
```

바뀐 패키지와 올릴 버전 종류를 고르고 요약을 쓰면 `.changeset/` 아래에 파일이 생깁니다. 이 파일을 함께 커밋합니다.

```md
---
"@hannam-lang/core": patch
---

`예???` 블록 안의 빈 줄이 사라지던 문제를 고쳤습니다.
```

- **요약은 한국어로, 사용자 입장에서 씁니다.** 그대로 CHANGELOG에 들어갑니다.
- 버전 종류: 아직 0.x이므로 기존 코드가 깨지는 변경은 `minor`, 그 밖의 기능 추가와 수정은 `patch`로 둡니다. `major`(1.0)는 메인테이너가 정합니다.
- changeset이 필요 없는 변경: 문서, 테스트, CI, 예제, private 패키지만 바꾼 경우. PR 설명에 "changeset 없음"과 이유를 적어 주세요.
- 버전 올리기와 배포는 메인테이너가 합니다. main에 병합되면 "Version Packages" PR이 자동으로 만들어집니다(`.github/RELEASING.md`).

`pnpm changeset status`로 지금 쌓인 changeset과 올라갈 버전을 볼 수 있습니다.

## 커밋 규칙

- 커밋 메시지, 코드 주석, 문서는 **한국어**로 씁니다.
- 제목은 `분류: 요약` 형태로 짧게 씁니다. 본문이 필요하면 빈 줄 하나 뒤에 `-` 목록으로 무엇을 왜 바꿨는지 적습니다.

  ```
  변환기: 예??? 블록 안 빈 줄 보존

  - case 사이 빈 줄이 사라져 소스맵 줄 번호가 어긋나던 문제
  - fixture switch.hn에 회귀 케이스 추가
  ```

  분류 예시: `변환기`, `CLI`, `문서`, `테스트`, `CI`, `릴리스`. 기존 커밋 로그(`git log --oneline`)를 참고하세요.
- 한 커밋에는 한 가지 일만 담고, 작은 단위로 나눠 커밋합니다.
- 관련 없는 파일의 포맷을 바꾸지 않습니다. 저장소 전체에 포매터를 일괄 적용하지 마세요. 편집기 설정은 `.editorconfig`를 따릅니다.

## PR 규칙

- main에서 브랜치를 만들어 PR을 엽니다. 한 PR에는 한 가지 주제만 담습니다.
- PR 템플릿의 확인 항목을 채워 주세요. CI가 통과해야 병합합니다.
- **문법을 바꾸는 PR은 명세(`docs/hannam-lang-syntax.md`)와 fixture를 같은 PR에서 함께 고칩니다.** 명세와 구현이 어긋나면 명세가 기준입니다.
- 새 의존성은 정확한 버전으로 고정합니다(`^`, `~` 없이).
- 큰 변경이나 새 밈은 PR 전에 이슈로 먼저 이야기해 주세요.

## 새 밈 제안 기준

새 밈 키워드는 이슈의 **새 밈 제안** 양식으로 먼저 제안해 주세요. 명세와 맥락 문서에 적힌 기준을 그대로 따릅니다.

> **채택 기준: 뉘앙스가 역할과 맞을 것, JS 기호와 충돌 없을 것, 오래 갈 밈일 것**
>
> — `docs/hannam-lang-context.md`, "주요 결정과 이유"

> 판단 기준: 투두 풀스택 데모에서 자주 쓰는가 + 밈 뉘앙스가 역할과 맞는가
>
> — `docs/hannam-lang-syntax.md`, "설탕 적용 범위"

명세의 설계 원칙도 함께 지켜야 합니다.

> - **한 형태 = 한 문법.** 밈의 변형(점·물음표·글자 개수, `~`·`!` 유무)은 각각 다른 문법이어야 하며, 같은 뜻의 별칭은 두지 않는다.
> - **설탕만 두고 별칭은 두지 않는다.** JS 기호 하나를 긴 밈으로 바꾸는 것(예: `!` → `아뇨아뇨아뇨아뇨!`)은 설탕이 아니다.
> - **플랫폼 API는 JS 그대로.** `fetch`, DOM 등은 이름을 바꾸지 않는다. 자주 쓰는 `console.log`, `confirm`만 예외로 설탕을 둔다.
>
> — `docs/hannam-lang-syntax.md`, "설계 원칙"

정리하면 제안에는 다음이 들어가야 합니다.

1. 밈 형태(글자 그대로)와 대응하는 JS 문법
2. `.hn` → `.js` 변환 예시 짝
3. 뉘앙스가 그 역할과 맞는 이유
4. 일반 JS 문법이나 기존 밈과 충돌하지 않는다는 검토 (명세의 "인식 규칙"과 기호 충돌 목록 참고)
5. 오래 갈 밈이라는 근거

이번 버전은 한남 말투 11개만 다룹니다. `true`/`false`, `import`/`export` 같은 빈자리에 일반 인터넷 밈을 넣는 안은 명세의 "다음 버전 후보"에 모아 두고 다음 버전에서 검토합니다.

## 질문과 버그

- 버그는 **버그 신고** 양식으로, 밈이 아닌 기능 제안은 **기능 제안** 양식으로 이슈를 열어 주세요.
- 재현할 수 있는 가장 짧은 `.hn` 코드가 있으면 가장 빨리 고칠 수 있습니다.
