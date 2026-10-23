# 릴리스 안내

mzscript는 [changesets](https://changesets.dev)로 버전과 CHANGELOG를 관리한다. 이 문서는 메인테이너용이다. 기여자가 알아야 할 changeset 작성법은 `CONTRIBUTING.md`에 있다.

## 흐름

1. 기여자가 PR에 `.changeset/*.md`를 넣는다.
2. PR이 main에 병합되면 `.github/workflows/release.yml`이 돈다.
3. changeset이 남아 있으면 `changeset-release/main` 브랜치에 버전을 올린 커밋을 만들고 **"릴리스 (Release): Version Packages" PR**을 열거나 갱신한다.
   - 이어서 같은 워크플로가 `install-matrix.yml`을 불러(npm 배포를 켠 뒤, 즉 `NPM_PUBLISH_ENABLED`가 `'true'`일 때만), 그 브랜치의 CLI 패키지를 npm·pnpm·yarn·bun으로 전역 설치해 확인한다.
   - 이 결과는 Version Packages PR의 체크에 붙지 않고 main 커밋의 Release 실행에 붙는다. **병합 전에 Actions 탭에서 그 실행의 "설치 매트릭스" job이 통과했는지 직접 확인한다.** 병합을 자동으로 막아 주지는 않는다.
4. 메인테이너가 Version Packages PR을 병합하면 changeset이 비고, npm에 아직 없는 버전이 생긴다. 이때 `publish` job이 돈다.
   - `main`에는 보호 규칙(Ruleset "main 보호")이 있다. Version Packages PR은 `GITHUB_TOKEN`으로 만들어져 CI가 돌지 않으므로, 관리자가 **Bypass rules and merge**로 병합한다.
5. `publish` job은 `npm` environment를 쓴다. environment에 승인자(`keemtj`)가 걸려 있어서, job이 시작되기 전에 GitHub가 승인을 요청한다. Actions 화면이나 알림 메일에서 **Approve**를 누르면 배포가 진행된다. 배포할 수 있는 브랜치는 `main`뿐이다.
6. 배포가 끝나면 패키지별 버전 태그(`mzscript@x.y.z`, `@mzscript/core@x.y.z`, `@mzscript/vite-plugin@x.y.z`)가 push되고, GitHub 릴리스가 **하나** 만들어진다. 태그는 `mzscript@x.y.z`, 제목은 `vx.y.z`이고, 본문은 `scripts/release-notes.mjs`가 세 패키지 CHANGELOG의 해당 버전 절을 모아 만든다.

## 묶음 버전

세 패키지(`mzscript`, `@mzscript/core`, `@mzscript/vite-plugin`)는 버전을 묶어서 낸다(`.changeset/config.json`의 `fixed`). changeset에 어느 패키지를 적든 세 패키지가 같은 버전으로 오르고, 사용자는 같은 버전끼리 쓰면 된다. 바뀌지 않은 패키지도 버전이 오른다.

## 배포 설정 (현재 상태)

- 저장소 변수 `NPM_PUBLISH_ENABLED` = `true`. `publish` job은 이 값이 정확히 `'true'`일 때만 돈다. 배포를 멈추려면 변수를 지우거나 다른 값으로 바꾼다.
- 인증은 **npm trusted publishing(OIDC)**이다. 세 패키지 모두 npmjs.com의 Trusted Publisher에 GitHub Actions(`keemtj/mzscript`, `release.yml`, environment `npm`, direct publish 허용)가 등록되어 있다. 토큰을 저장하지 않으며 provenance(출처 증명)가 함께 붙는다.
- `NPM_TOKEN` 시크릿은 두지 않는다. 시크릿이 없으면 `NODE_AUTH_TOKEN`이 빈 값이 되어 OIDC로 인증한다.
- 세 패키지의 Publishing access는 "Require two-factor authentication and disallow bypass 2fa tokens"이다. 사람이 배포할 때는 2FA가 필요하고, 2FA를 건너뛰는 토큰은 쓸 수 없다. trusted publishing은 이 설정과 상관없이 동작한다.
- `changeset publish`는 pnpm 워크스페이스에서 `pnpm publish`를 호출하고, pnpm은 내부에서 npm CLI로 업로드한다. trusted publishing에는 npm 11.5.1 이상이 필요해서 `publish` job은 npm 11이 들어 있는 Node 24를 쓴다.
- 0.1.0은 trusted publisher를 등록하기 전이라 메인테이너가 로컬에서 직접 배포했다(`pnpm release`, 2026-10-22). OIDC 배포는 0.1.1부터 처음 돌므로, 그때 Actions 로그에서 인증과 provenance를 한 번 확인한다.

## VS Code 확장

`packages/vscode`는 이번 출시에 포함하지 않는다(마켓플레이스 배포 보류). npm에도 올리지 않고(private), changeset 대상도 아니다. 저장소에서 `.vsix`를 만들어 설치하는 방법은 `packages/vscode/README.md`에 있다.

## 패키지 체크리스트

- provenance를 붙여 배포하므로 **공개 패키지마다 `package.json`에 `repository` 필드가 있어야 한다.** npm이 provenance의 저장소와 `repository.url`을 대조해서, 없거나 다르면 publish가 E422로 실패한다.

  ```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<owner>/mzscript.git",
    "directory": "packages/core"
  }
  ```


## 저장소 설정 체크리스트

- Settings → Actions → General → **Allow GitHub Actions to create and approve pull requests**를 켠다. 꺼져 있으면 Version Packages PR을 만들지 못한다.
- `GITHUB_TOKEN`으로 만든 PR에서는 `pull_request` 워크플로(CI 포함)가 자동으로 돌지 않는다. 설치 매트릭스는 `release.yml`이 직접 불러서 돌리지만, Version Packages PR에 CI 체크가 필요하면 GitHub App 토큰을 `changesets/action/version`의 `github-token`으로 넘겨야 한다.

## 로컬에서 미리 보기

```sh
pnpm changeset status          # 쌓인 changeset과 올라갈 버전
pnpm version-packages          # 실제로 버전·CHANGELOG를 바꾼다. 확인 후 git으로 되돌린다
bash scripts/install-matrix.sh # 전역 설치 매트릭스 (로컬 임시 레지스트리 사용, npm에는 올리지 않음)
```

`pnpm release`(빌드 후 `changeset publish`)는 실제 npm 배포이므로 로컬에서 실행하지 않는다.

## changelog와 GitHub 토큰

changelog는 `@changesets/changelog-github`(`keemtj/mzscript`)로 만든다. 커밋·PR 링크를 GitHub API에서 가져오므로 `pnpm version-packages`에는 `GITHUB_TOKEN`이 필요하다. CI에서는 워크플로가 넘겨 주고, 로컬에서 직접 돌릴 때는 `GITHUB_TOKEN=$(gh auth token) pnpm version-packages`처럼 실행한다.

첫 공개 버전은 `.changeset/first-public-release.md`로 `@mzscript/core`, `mzscript`, `@mzscript/vite-plugin`을 0.1.0으로 올린다. 사이트, Playground, 예제는 배포하지 않으므로 changeset 대상에서 뺐다(`ignore`).
