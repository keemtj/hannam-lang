#!/usr/bin/env bash
# hannam-lang CLI 패키지를 npm, pnpm, yarn(classic), bun으로 각각 전역 설치해 확인한다.
#
# 사용법:
#   scripts/install-matrix.sh            # 4종 모두
#   scripts/install-matrix.sh npm bun    # 고른 것만
#
# 흐름:
#   1. 워크스페이스 빌드 후 공개 패키지를 모두 pnpm pack (workspace:* 의존성이 실제 버전으로 바뀜)
#   2. 임시 디렉터리에 로컬 레지스트리(verdaccio)를 띄우고 tarball을 올림
#      CLI가 @hannam-lang/core 같은 아직 npm에 없는 패키지에 의존해도 설치되게 하려는 것
#   3. 패키지 매니저마다 임시 prefix에 전역 설치하고 `hannam --version`, hello.hn 실행을 확인
#
# 실제 전역 디렉터리나 npm 레지스트리는 건드리지 않는다. 임시 디렉터리는 끝나면 지운다.
# 레지스트리는 이 스크립트가 띄운 것인지 확인한 뒤에만 publish하고, 끝나면 그 프로세스만 종료한다.
#
# 환경 변수:
#   HN_PACKAGE_DIR    확인할 CLI 패키지 (기본: packages/hannam-lang)
#   HN_REGISTRY_PORT  로컬 레지스트리 포트 (기본: 비어 있는 포트를 자동으로 고름)
#   HN_SKIP_BUILD=1   빌드 생략 (CI에서 이미 빌드한 경우)
#   HN_KEEP_WORK=1    임시 디렉터리를 지우지 않음 (디버깅용)

set -euo pipefail

VERDACCIO_VERSION="6.10.5"
YARN_VERSION="1.22.22"
BUN_VERSION="1.4.2"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT/${HN_PACKAGE_DIR:-packages/hannam-lang}"

if [ "$#" -gt 0 ]; then
  MANAGERS=("$@")
else
  MANAGERS=(npm pnpm yarn bun)
fi

for pm in "${MANAGERS[@]}"; do
  case "$pm" in
    npm | pnpm | yarn | bun) ;;
    *)
      echo "알 수 없는 패키지 매니저: $pm (npm, pnpm, yarn, bun 중에서 고른다)" >&2
      exit 2
      ;;
  esac
done

if [ ! -f "$PACKAGE_DIR/package.json" ]; then
  echo "CLI 패키지가 없다: $PACKAGE_DIR/package.json" >&2
  echo "packages/hannam-lang이 생긴 뒤에 다시 실행하거나 HN_PACKAGE_DIR로 경로를 지정한다." >&2
  exit 1
fi

case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) IS_WINDOWS=1 ;;
  *) IS_WINDOWS=0 ;;
esac

WORK="$(mktemp -d)"
REGISTRY_PID=""

# shellcheck disable=SC2329 # trap으로 호출
cleanup() {
  if [ -n "$REGISTRY_PID" ]; then
    kill "$REGISTRY_PID" 2>/dev/null || true
    wait "$REGISTRY_PID" 2>/dev/null || true
  fi
  if [ "${HN_KEEP_WORK:-}" = "1" ]; then
    echo "임시 디렉터리를 남겨 둔다: $WORK"
  else
    rm -rf "$WORK"
  fi
}
trap cleanup EXIT

log() {
  printf '\n== %s\n' "$*"
}

# package.json 필드 하나를 읽는다
pkg_field() {
  node -e 'const p = require(process.argv[1]); process.stdout.write(String(p[process.argv[2]] ?? ""))' "$1/package.json" "$2"
}

CLI_NAME="$(pkg_field "$PACKAGE_DIR" name)"
CLI_VERSION="$(pkg_field "$PACKAGE_DIR" version)"

# ---------------------------------------------------------------------------
# 1. 빌드와 pack
# ---------------------------------------------------------------------------

if [ "${HN_SKIP_BUILD:-}" != "1" ]; then
  log "워크스페이스 빌드"
  (cd "$ROOT" && pnpm -r build)
fi

log "공개 패키지 pack"
mkdir -p "$WORK/tarballs"
PACKED_NAMES=()
for dir in "$ROOT"/packages/*/; do
  dir="${dir%/}"
  [ -f "$dir/package.json" ] || continue
  if [ "$(pkg_field "$dir" private)" = "true" ]; then
    continue
  fi
  (cd "$dir" && pnpm pack --pack-destination "$WORK/tarballs" > /dev/null)
  PACKED_NAMES+=("$(pkg_field "$dir" name)")
  echo "pack: $(pkg_field "$dir" name)@$(pkg_field "$dir" version)"
done

# ---------------------------------------------------------------------------
# 2. 로컬 레지스트리
# ---------------------------------------------------------------------------

# 포트를 지정하지 않으면 OS가 비어 있는 포트를 고르게 한다
if [ -n "${HN_REGISTRY_PORT:-}" ]; then
  PORT="$HN_REGISTRY_PORT"
else
  PORT="$(node -e 'const s = require("node:net").createServer(); s.listen(0, "127.0.0.1", () => { process.stdout.write(String(s.address().port)); s.close() })')"
fi
REGISTRY="http://127.0.0.1:$PORT/"

# 이미 누가 쓰고 있는 포트면 남의 레지스트리에 publish하게 되므로 바로 멈춘다
if curl -s -o /dev/null --max-time 2 "$REGISTRY"; then
  echo "${PORT} 포트는 이미 다른 프로세스가 쓰고 있다. HN_REGISTRY_PORT를 비우거나 다른 포트를 지정한다." >&2
  exit 1
fi

log "로컬 레지스트리 시작 ($REGISTRY)"
mkdir -p "$WORK/registry"
# 응답한 레지스트리가 이 스크립트가 띄운 것인지 가려내는 표식
NONCE="hn-install-matrix-$$-$RANDOM$RANDOM"
(cd "$WORK/registry" && npm install "verdaccio@$VERDACCIO_VERSION" --prefix ./tool \
  --no-save --no-package-lock --no-audit --no-fund --loglevel error --cache "$WORK/npm-cache" > /dev/null)
{
  echo "web:"
  echo "  title: $NONCE"
  echo "storage: ./storage"
  echo "auth:"
  echo "  htpasswd:"
  echo "    file: ./htpasswd"
  echo "uplinks:"
  echo "  npmjs:"
  echo "    url: https://registry.npmjs.org/"
  echo "packages:"
  # 워크스페이스 패키지는 npm으로 프록시하지 않는다 (같은 이름이 npm에 있어도 로컬 것을 쓴다)
  for name in "${PACKED_NAMES[@]}"; do
    echo "  '$name':"
    echo "    access: \$all"
    echo "    publish: \$authenticated"
  done
  echo "  '**':"
  echo "    access: \$all"
  echo "    proxy: npmjs"
  echo "log: { type: stdout, format: pretty, level: warn }"
} > "$WORK/registry/config.yaml"

# npx를 거치지 않고 node로 바로 띄워서 $!가 verdaccio 프로세스 자신을 가리키게 한다
(cd "$WORK/registry" && exec node ./tool/node_modules/verdaccio/bin/verdaccio --config ./config.yaml --listen "127.0.0.1:$PORT") \
  > "$WORK/registry/verdaccio.log" 2>&1 &
REGISTRY_PID=$!

registry_failed() {
  echo "$1" >&2
  cat "$WORK/registry/verdaccio.log" >&2
  exit 1
}

for _ in $(seq 1 60); do
  if ! kill -0 "$REGISTRY_PID" 2>/dev/null; then
    registry_failed "레지스트리가 시작되지 않았다:"
  fi
  if curl -fsS "${REGISTRY}-/ping" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# 응답한 서버가 이 스크립트가 띄운 verdaccio인지 확인한다
if ! kill -0 "$REGISTRY_PID" 2>/dev/null; then
  registry_failed "레지스트리 프로세스가 종료됐다:"
fi
# pipefail에서 grep -q가 먼저 끝나 curl이 SIGPIPE로 실패하지 않도록 본문을 먼저 받는다
REGISTRY_HOME="$(curl -fsS "$REGISTRY" 2>/dev/null || true)"
if ! grep -q "$NONCE" <<< "$REGISTRY_HOME"; then
  registry_failed "${PORT} 포트에서 응답한 레지스트리가 이 스크립트가 띄운 것이 아니다:"
fi
# lsof가 있으면 포트를 연 프로세스의 PID도 대조한다 (Windows Git Bash에는 없어서 위의 표식으로만 확인)
if command -v lsof > /dev/null 2>&1; then
  LISTEN_PID="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1)"
  if [ "$LISTEN_PID" != "$REGISTRY_PID" ]; then
    registry_failed "${PORT} 포트를 연 프로세스($LISTEN_PID)가 띄운 레지스트리($REGISTRY_PID)와 다르다:"
  fi
fi
echo "레지스트리 PID $REGISTRY_PID 확인"

log "tarball을 로컬 레지스트리에 올림"
TOKEN="$(curl -fsS -X PUT -H 'content-type: application/json' \
  -d '{"name":"install-matrix","password":"install-matrix"}' \
  "${REGISTRY}-/user/org.couchdb.user:install-matrix" |
  node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => process.stdout.write(JSON.parse(s).token))')"
NPMRC="$WORK/npmrc"
printf '//127.0.0.1:%s/:_authToken=%s\n' "$PORT" "$TOKEN" > "$NPMRC"

for tarball in "$WORK"/tarballs/*.tgz; do
  (cd "$WORK" && npm publish "$tarball" --registry "$REGISTRY" --userconfig "$NPMRC" --cache "$WORK/npm-cache" --loglevel warn)
done

# ---------------------------------------------------------------------------
# 3. 패키지 매니저별 전역 설치와 확인
# ---------------------------------------------------------------------------

mkdir -p "$WORK/hello"
cat > "$WORK/hello/hello.hn" << 'EOF'
엄... 설치 매트릭스 확인용
엄.. 이름 = "한남랭"
무슨 발언이세요? `안녕, ${이름}!`
EOF
EXPECTED_HELLO="안녕, 한남랭!"

run_bun() {
  if command -v bun > /dev/null 2>&1; then
    bun "$@"
  else
    npx --yes "bun@$BUN_VERSION" "$@"
  fi
}

# 패키지 매니저가 전역 bin을 두는 위치 (npm, yarn은 Windows에서 prefix 바로 아래)
bin_dir_for() {
  local pm="$1"
  local prefix="$WORK/pm/$pm"
  case "$pm" in
    npm)
      if [ "$IS_WINDOWS" = "1" ]; then echo "$prefix"; else echo "$prefix/bin"; fi
      ;;
    yarn)
      # yarn classic이 bin을 두는 위치는 OS마다 달라서 짐작하지 않고 yarn에게 묻는다
      local dir
      dir="$(cd "$WORK" && npx --yes "yarn@$YARN_VERSION" global bin --prefix "$prefix" 2>/dev/null | tail -n 1)"
      if [ "$IS_WINDOWS" = "1" ] && command -v cygpath >/dev/null 2>&1; then dir="$(cygpath -u "$dir")"; fi
      echo "${dir:-$prefix/bin}"
      ;;
    pnpm | bun) echo "$prefix/bin" ;;
  esac
}

# 패키지 매니저 하나로 임시 prefix에 전역 설치한다. 각 case의 마지막 명령이 설치 결과다
install_with() {
  local pm="$1"
  local prefix="$WORK/pm/$pm"
  local bin_dir
  bin_dir="$(bin_dir_for "$pm")"
  # if 조건 안에서 불리면 set -e가 꺼지므로 준비 단계 실패는 직접 돌려준다
  mkdir -p "$prefix" "$bin_dir" || return 1
  cd "$WORK" || return 1
  case "$pm" in
    npm)
      npm install -g "$CLI_NAME@$CLI_VERSION" --prefix "$prefix" --registry "$REGISTRY" \
        --cache "$prefix/cache" --userconfig "$NPMRC" --loglevel warn
      ;;
    pnpm)
      PNPM_HOME="$bin_dir" PATH="$bin_dir:$PATH" pnpm add -g "$CLI_NAME@$CLI_VERSION" \
        --registry "$REGISTRY" \
        --config.global-dir="$prefix/global" \
        --config.global-bin-dir="$bin_dir" \
        --config.store-dir="$prefix/store" \
        --config.cache-dir="$prefix/cache"
      ;;
    yarn)
      # yarn classic의 global add는 --registry를 무시하므로 yarnrc로 지정한다
      printf 'registry "%s"\n' "$REGISTRY" > "$prefix/yarnrc" || return 1
      npx --yes "yarn@$YARN_VERSION" --use-yarnrc "$prefix/yarnrc" global add "$CLI_NAME@$CLI_VERSION" \
        --registry "$REGISTRY" \
        --prefix "$prefix" \
        --global-folder "$prefix/global" \
        --cache-folder "$prefix/cache" \
        --non-interactive
      ;;
    bun)
      BUN_INSTALL="$prefix" \
        BUN_INSTALL_BIN="$bin_dir" \
        BUN_INSTALL_GLOBAL_DIR="$prefix/global" \
        BUN_INSTALL_CACHE_DIR="$prefix/cache" \
        BUN_CONFIG_REGISTRY="$REGISTRY" \
        run_bun add -g "$CLI_NAME@$CLI_VERSION" --registry "$REGISTRY"
      ;;
  esac
}

# 설치된 bin이 임시 prefix 안의 것인지, 버전과 hello.hn 실행 결과가 맞는지 확인한다
verify_with() {
  local pm="$1"
  local bin_dir bin_path version_out hello_out
  bin_dir="$(bin_dir_for "$pm")"
  (
    export PATH="$bin_dir:$PATH"
    bin_path="$(command -v hannam || true)"
    case "$bin_path" in
      "$bin_dir"/*) ;;
      *)
        echo "[$pm] hannam이 설치 위치($bin_dir)에서 잡히지 않는다: '${bin_path}'" >&2
        exit 1
        ;;
    esac
    case "$(command -v hnc || true)" in
      "$bin_dir"/*) ;;
      *)
        echo "[$pm] hnc가 설치 위치($bin_dir)에서 잡히지 않는다" >&2
        exit 1
        ;;
    esac

    version_out="$(hannam --version)" || exit 1
    echo "[$pm] hannam --version → $version_out"
    case "$version_out" in
      *"$CLI_VERSION"*) ;;
      *)
        echo "[$pm] 버전 출력에 ${CLI_VERSION} 문자열이 없다" >&2
        exit 1
        ;;
    esac

    hello_out="$(cd "$WORK/hello" && hannam hello.hn)" || exit 1
    hello_out="${hello_out%$'\r'}"
    echo "[$pm] hannam hello.hn → $hello_out"
    if [ "$hello_out" != "$EXPECTED_HELLO" ]; then
      echo "[$pm] hello.hn 출력이 다르다. 기대값: $EXPECTED_HELLO" >&2
      exit 1
    fi
  )
}

RESULTS=()
FAILED=0
for pm in "${MANAGERS[@]}"; do
  log "$pm: $CLI_NAME@$CLI_VERSION 전역 설치"
  if (install_with "$pm") && verify_with "$pm"; then
    RESULTS+=("$pm: 통과")
  else
    RESULTS+=("$pm: 실패")
    FAILED=1
  fi
done

log "결과"
printf '%s\n' "${RESULTS[@]}"
exit "$FAILED"
