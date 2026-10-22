# 릴리스 안내

hannam-lang은 [changesets](https://changesets.dev)로 버전과 CHANGELOG를 관리한다. 이 문서는 메인테이너용이다. 기여자가 알아야 할 changeset 작성법은 `CONTRIBUTING.md`에 있다.

## 흐름

1. 기여자가 PR에 `.changeset/*.md`를 넣는다.
2. PR이 main에 병합되면 `.github/workflows/release.yml`이 돈다.
3. changeset이 남아 있으면 `changeset-release/main` 브랜치에 버전을 올린 커밋을 만들고 **"릴리스: Version Packages" PR**을 열거나 갱신한다.
   - 이어서 같은 워크플로가 `install-matrix.yml`을 불러, 그 브랜치의 CLI 패키지를 npm·pnpm·yarn·bun으로 전역 설치해 확인한다.
   - 이 결과는 Version Packages PR의 체크에 붙지 않고 main 커밋의 Release 실행에 붙는다. **병합 전에 Actions 탭에서 그 실행의 "설치 매트릭스" job이 통과했는지 직접 확인한다.** 병합을 자동으로 막아 주지는 않는다.
   - `packages/hannam-lang`이 아직 없으면 매트릭스는 건너뛴다(notice만 남김).
4. 메인테이너가 Version Packages PR을 병합하면 changeset이 비고, npm에 아직 없는 버전이 생긴다. 이때 `publish` job이 대상이 된다.
5. **npm 배포는 기본으로 꺼져 있다.** 아래 "배포 켜기"를 하기 전까지 `publish` job은 건너뛴다(skipped).

## 배포 켜기

`publish` job은 저장소 변수 `NPM_PUBLISH_ENABLED`가 정확히 `'true'`일 때만 돈다. 변수가 없거나 다른 값이면 실행되지 않는다.

1. Settings → Secrets and variables → Actions → **Variables**에 `NPM_PUBLISH_ENABLED` = `true`를 추가한다.
2. 아래 두 인증 방식 중 하나를 준비한다.
3. `publish` job은 `npm` environment를 쓴다. Settings → Environments → `npm`에 승인자(required reviewers)를 걸어 두면 배포 직전에 사람이 한 번 더 확인할 수 있다.

끄려면 변수를 지우거나 `true`가 아닌 값으로 바꾼다.

### 인증 방식 A: npm trusted publishing (OIDC, 권장)

토큰을 저장하지 않고 GitHub Actions의 OIDC 토큰으로 배포한다. provenance(출처 증명)도 함께 붙는다.

- npmjs.com의 각 패키지 설정(Settings → Trusted publishing)에 GitHub Actions를 등록한다: 저장소 이름, 워크플로 파일 `release.yml`, environment `npm`.
- trusted publisher는 이미 npm에 있는 패키지에만 등록할 수 있다. 그래서 **첫 배포는 방식 B의 토큰이나 메인테이너의 수동 배포로 해야 한다.**
- `NPM_TOKEN` 시크릿은 만들지 않는다. 시크릿이 없으면 `NODE_AUTH_TOKEN`이 빈 값이 되어 OIDC로 인증한다.
- `changeset publish`는 pnpm 워크스페이스에서 `pnpm publish`를 호출하고, pnpm은 내부에서 npm CLI로 업로드한다. trusted publishing에는 npm 11.5.1 이상이 필요해서 `publish` job은 npm 11이 들어 있는 Node 24를 쓴다. 첫 OIDC 배포 때 로그에서 인증 방식을 한 번 확인한다.

### 인증 방식 B: `NPM_TOKEN` 시크릿

- npmjs.com에서 granular access token(배포 권한, 대상 패키지 한정)을 만든다.
- Settings → Secrets and variables → Actions → **Secrets**에 `NPM_TOKEN`으로 저장한다. 위의 `npm` environment 시크릿으로 넣어도 된다.
- 워크플로는 이 값을 `NODE_AUTH_TOKEN`으로 넘긴다. `id-token: write` 권한이 있으므로 provenance는 이 방식에서도 붙는다.

## 패키지 체크리스트

- provenance를 붙여 배포하므로 **공개 패키지마다 `package.json`에 `repository` 필드가 있어야 한다.** npm이 provenance의 저장소와 `repository.url`을 대조해서, 없거나 다르면 publish가 E422로 실패한다.

  ```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<owner>/hannam-lang.git",
    "directory": "packages/core"
  }
  ```

- 2026-10-22 기준 `packages/core/package.json`에는 이 필드가 없다. 배포를 켜기 전에 추가한다.

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
