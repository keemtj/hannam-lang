// 빌드된 사이트를 next start로 띄워서 확인한다.
// 1. 메인·문서·/playground가 200인지
// 2. 문서의 ```hn 블록이 하이라이팅 span으로 칠해졌는지
// 3. 사이트 안 링크(전체 크롤링)가 404가 아닌지
// 4. headless 브라우저로 /playground와 문서 TryIt에서 코드를 실행해 콘솔 출력이 나오는지
// 5. 메인 페이지 데스크톱·모바일 스크린샷 (라이트·다크)
//
// 사용법: pnpm build 후 node scripts/check-site.mjs [스크린샷 디렉터리]
// 서버는 빈 포트에 띄우고, 그 포트를 이 스크립트가 띄운 프로세스가 쓰는지 확인한 뒤, 끝나면 그 프로세스만 종료한다.
import { execFileSync, spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const siteDir = fileURLToPath(new URL("..", import.meta.url))
const shotDir = resolve(process.argv[2] ?? resolve(siteDir, ".next/check-screenshots"))
mkdirSync(shotDir, { recursive: true })

let failures = 0
const fail = (msg) => {
  failures++
  console.error(`✗ ${msg}`)
}
const ok = (msg) => console.log(`✓ ${msg}`)

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer()
    s.once("error", rej)
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address()
      s.close(() => res(port))
    })
  })
}

// 포트를 듣고 있는 프로세스 PID 목록 (macOS·Linux lsof)
function listeningPids(port) {
  try {
    return execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map(Number)
  } catch (e) {
    // lsof는 듣는 프로세스가 없으면 종료 코드 1로 끝난다. 명령 자체가 없으면 확인할 수 없다
    if (e.code === "ENOENT") throw new Error("lsof가 없어 포트 소유자를 확인할 수 없음")
    return []
  }
}

// 자식 프로세스와 그 자손 PID
function descendants(pid) {
  const out = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" })
  const children = new Map()
  for (const line of out.trim().split("\n")) {
    const [p, pp] = line.trim().split(/\s+/).map(Number)
    if (!children.has(pp)) children.set(pp, [])
    children.get(pp).push(p)
  }
  const result = new Set([pid])
  const stack = [pid]
  while (stack.length) {
    for (const c of children.get(stack.pop()) ?? []) {
      result.add(c)
      stack.push(c)
    }
  }
  return result
}

const port = await freePort()
const base = `http://127.0.0.1:${port}`
const nextBin = resolve(siteDir, "node_modules/next/dist/bin/next")
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"], {
  cwd: siteDir,
  stdio: ["ignore", "pipe", "pipe"],
})
let serverLog = ""
server.stdout.on("data", (d) => (serverLog += d))
server.stderr.on("data", (d) => (serverLog += d))

function stopServer() {
  if (server.exitCode === null && server.signalCode === null) server.kill("SIGTERM")
}
process.on("exit", stopServer)
// 스크립트가 신호로 끝나도 띄운 서버를 남기지 않는다
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stopServer()
    process.exit(1)
  })
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`next start가 바로 끝남 (pnpm build를 먼저 했는지 확인)\n${serverLog}`)
    try {
      const r = await fetch(base)
      if (r.ok) return
    } catch {
      // 아직 뜨는 중
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`서버가 뜨지 않음\n${serverLog}`)
}

try {
  await waitForServer()
  const owners = listeningPids(port)
  const mine = descendants(server.pid)
  if (owners.length === 0 || !owners.every((p) => mine.has(p))) {
    throw new Error(`포트 ${port}를 다른 프로세스가 쓰고 있음 (리스너 ${owners.join(",")}, 내 프로세스 ${[...mine].join(",")})`)
  }
  ok(`next start: ${base} (리스너 PID ${owners.join(",")}는 이 스크립트가 띄운 프로세스)`)

  // 1. 주요 페이지
  const mainPages = [
    "/",
    "/playground",
    "/docs",
    "/docs/getting-started/installation",
    "/docs/getting-started/first-program",
    "/docs/syntax",
    "/docs/syntax/conditionals",
    "/docs/syntax/loops",
    "/docs/guides/todo-fullstack",
    "/docs/tools/errors",
    "/docs/contributing",
  ]
  for (const path of mainPages) {
    const r = await fetch(base + path)
    r.status === 200 ? ok(`${path} 200`) : fail(`${path} ${r.status}`)
  }

  // 2. hn 하이라이팅: 밈 키워드가 JS 키워드 색(github 테마의 keyword 색)을 받은 span으로 나오는지
  {
    const html = await (await fetch(`${base}/docs/syntax/conditionals`)).text()
    // 밈 글자만 담은 span이 기본 글자색(#24292E)이 아닌 색을 받았는지 본다 (줄 앞 공백은 span에 함께 들어갈 수 있음)
    const memeSpans = ["예?", "예??", "아뇨아뇨아뇨아뇨", "예???", "무슨 발언이세요?"].map((meme) => {
      const re = new RegExp(`<span style="--shiki-light:(#[0-9A-F]{6});--shiki-dark:#[0-9A-F]{6}">\\s*${meme.replace(/[?]/g, "\\?")}</span>`, "g")
      const colors = [...html.matchAll(re)].map((m) => m[1])
      return [meme, colors.length > 0 && colors.every((c) => c !== "#24292E")]
    })
    for (const [meme, found] of memeSpans) {
      found ? ok(`hn 하이라이팅: '${meme}' 키워드 span`) : fail(`hn 하이라이팅: '${meme}' span 없음`)
    }
    // 문자열 안의 밈 글자는 키워드로 칠하지 않는다
    const loops = await (await fetch(`${base}/docs/syntax/recognition`)).text()
    ;/<pre[^>]*>[\s\S]*?<span style="--shiki-light:#D73A49;--shiki-dark:#F97583">티~원!<\/span>/.test(loops)
      ? ok("hn 하이라이팅: 템플릿 ${} 안의 '티~원!' span")
      : fail("hn 하이라이팅: 템플릿 ${} 안의 '티~원!' span 없음")
  }

  // 3. 사이트 안 링크 크롤링
  {
    const seen = new Map()
    const queue = ["/"]
    while (queue.length) {
      const path = queue.shift()
      if (seen.has(path)) continue
      const r = await fetch(base + path, { redirect: "manual" })
      seen.set(path, r.status)
      if (r.status !== 200 || !(r.headers.get("content-type") ?? "").includes("text/html")) continue
      const html = await r.text()
      for (const m of html.matchAll(/href="([^"]+)"/g)) {
        const href = m[1].replace(/&amp;/g, "&")
        if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/_next/")) continue
        const clean = decodeURI(href.split("#")[0].split("?")[0]) || "/"
        if (!seen.has(clean)) queue.push(encodeURI(clean))
      }
    }
    const bad = [...seen].filter(([, status]) => status >= 400)
    bad.length === 0 ? ok(`사이트 안 링크 ${seen.size}개 모두 404 아님`) : bad.forEach(([p, s]) => fail(`링크 ${p} → ${s}`))
  }

  // 4·5. 브라우저 확인
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const pageErrors = []
    page.on("pageerror", (e) => pageErrors.push(e.message))

    // /playground: 코드를 바꿔 실행하고 콘솔 출력 확인
    await page.goto(`${base}/playground`)
    const editor = page.locator('[data-testid="hn-editor"] .cm-content')
    await editor.waitFor({ timeout: 20000 })
    await editor.click()
    await page.keyboard.press("ControlOrMeta+A")
    await page.keyboard.press("Backspace")
    await page.keyboard.insertText('엄.. 이름 = "한남랭"\n요이~ i 0..3 {\n무슨 발언이세요? `${이름} ${i}번`\n}\n')
    await page.locator('[data-testid="js-output"]').getByText("for (let i = 0; i < 3; i++)").waitFor({ timeout: 10000 })
    ok("/playground: 입력한 .hn이 JS로 변환되어 보임")
    await page.getByRole("button", { name: /실행/ }).first().click()
    const consoleBox = page.locator('[data-testid="console"]')
    await consoleBox.getByText("한남랭 2번").waitFor({ timeout: 15000 })
    const lines = (await consoleBox.innerText()).trim()
    ok(`/playground: 실행 후 콘솔 출력\n${lines.replace(/^/gm, "    ")}`)
    // 코드는 입력이 멈추고 300ms 뒤에 해시로 저장된다
    await page.waitForFunction(() => location.hash.startsWith("#code/"), null, { timeout: 5000 }).catch(() => {})
    const hash = new URL(page.url()).hash
    hash.startsWith("#code/") ? ok("/playground: syncUrl로 코드가 주소 해시에 저장됨") : fail(`/playground 해시 없음 (${hash})`)
    await page.screenshot({ path: resolve(shotDir, "playground-desktop.png") })

    // 해시로 다시 열면 같은 코드로 시작
    const reopened = await context.newPage()
    await reopened.goto(`${base}/playground${hash}`)
    await reopened.locator('[data-testid="hn-editor"] .cm-content').getByText("${이름} ${i}번").waitFor({ timeout: 20000 })
    ok("/playground: 공유 해시로 열면 같은 코드로 복원")
    await reopened.close()

    // 문서 TryIt 블록 (syncUrl 꺼짐)
    await page.goto(`${base}/docs/syntax/loops`)
    const tryIt = page.locator(".hn-tryit").first()
    await tryIt.locator(".cm-content").first().waitFor({ timeout: 20000 })
    await tryIt.getByRole("button", { name: /실행/ }).first().click()
    await tryIt.locator('[data-testid="console"]').getByText("남은 수:").first().waitFor({ timeout: 15000 })
    ok("문서 TryIt: /docs/syntax/loops에서 실행 후 콘솔 출력 나옴")
    new URL(page.url()).hash === "" ? ok("문서 TryIt: 주소 해시를 건드리지 않음") : fail("문서 TryIt이 해시를 바꿈")

    pageErrors.length === 0 ? ok("페이지 에러 없음") : fail(`페이지 에러: ${pageErrors.join(" | ")}`)

    // 메인 페이지 스크린샷
    for (const scheme of ["light", "dark"]) {
      for (const [name, viewport, isMobile] of [
        ["desktop", { width: 1440, height: 900 }, false],
        ["mobile", { width: 390, height: 844 }, true],
      ]) {
        const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, colorScheme: scheme, deviceScaleFactor: isMobile ? 2 : 1 })
        const p = await ctx.newPage()
        await p.goto(base + "/", { waitUntil: "networkidle" })
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        overflow <= 0 ? ok(`메인 ${name}/${scheme}: 가로 넘침 없음`) : fail(`메인 ${name}/${scheme}: 가로로 ${overflow}px 넘침`)
        const file = resolve(shotDir, `home-${name}-${scheme}.png`)
        await p.screenshot({ path: file, fullPage: true })
        ok(`스크린샷 ${file}`)
        if (name === "mobile" && scheme === "light") {
          await p.goto(base + "/docs/syntax/conditionals", { waitUntil: "networkidle" })
          await p.screenshot({ path: resolve(shotDir, "docs-mobile-light.png") })
        }
        if (name === "desktop" && scheme === "dark") {
          await p.goto(base + "/docs/syntax/conditionals", { waitUntil: "networkidle" })
          await p.screenshot({ path: resolve(shotDir, "docs-desktop-dark.png") })
        }
        await ctx.close()
      }
    }
  } finally {
    await browser.close()
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e))
} finally {
  stopServer()
}

console.log(failures ? `실패 ${failures}개` : "모두 통과")
process.exit(failures ? 1 : 0)
