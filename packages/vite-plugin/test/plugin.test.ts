import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { createServer as createNetServer } from "node:net"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { build, createServer, normalizePath, type ViteDevServer } from "vite"
import { afterAll, describe, expect, it } from "vitest"
import mzscript from "../src/index.js"
// Node 20에는 전역 WebSocket이 없어서(Node 22부터 기본) HMR 채널은 ws 클라이언트로 연결한다
import WebSocket from "ws"

// 임시 프로젝트는 패키지 안에 만든다. dev 서버의 fs.allow가 모노레포 루트를 작업 영역으로 잡아야
// packages/core/dist의 런타임 파일을 내줄 수 있다 (실제 사용자 앱이 node_modules에서 받는 것과 같은 조건)
const TMP_ROOT = join(dirname(fileURLToPath(import.meta.url)), ".tmp")
const RUNTIME_PATH = fileURLToPath(import.meta.resolve("@mzscript/core/runtime"))

const INDEX_HTML = `<!doctype html>
<html>
  <body>
    <script type="module" src="./main.mz"></script>
  </body>
</html>
`

// 문자열이 아닐 수도 있는 값을 throw하면 런타임 헬퍼(__mz.toError)가 필요하다
const UTIL_HN = `엄... 런타임 헬퍼를 쓰는 모듈
export 티-원 던지기(값) {
  아... 줴줴이야... 값
}

export 티-원 더하기(a, b) {
  아! 줴줴이야~ a + b
}
`

const MAIN_HN = `import { 던지기, 더하기 } from "./util.mz"

엄. 메시지 = ""
진~지? {
  던지기("터졌다")
} 지~랄 에러 {
  메시지 = 에러.message
}
globalThis.결과 = { 합: 더하기(1, 2), 메시지 }
`

// 3번째 줄의 return 오타는 컴파일 에러다
const BAD_HN = `엄.. 첫줄 = 1\n티-원 f() {\n  아! 줴줴이야 첫줄\n}\n`

const tmpDirs: string[] = []

async function makeProject(files: Record<string, string>): Promise<string> {
  await mkdir(TMP_ROOT, { recursive: true })
  const root = await mkdtemp(join(TMP_ROOT, "project-"))
  tmpDirs.push(root)
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(root, name), content)
  }
  return root
}

afterAll(async () => {
  await Promise.all(tmpDirs.map(dir => rm(dir, { recursive: true, force: true })))
})

interface BuildError {
  message: string
  id?: string
  loc?: { file?: string; line: number; column: number }
  frame?: string
}

function buildProject(root: string) {
  return build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [mzscript()],
    // Node에서 바로 실행할 수 있게 document를 쓰는 modulepreload 폴리필은 뺀다
    build: { outDir: join(root, "dist"), minify: false, sourcemap: true, modulePreload: { polyfill: false } },
  })
}

describe("build", () => {
  it("HTML의 .mz 진입점을 빌드하고, 결과 JS가 실행된다", async () => {
    const root = await makeProject({ "index.html": INDEX_HTML, "main.mz": MAIN_HN, "util.mz": UTIL_HN })
    await buildProject(root)

    const html = await readFile(join(root, "dist/index.html"), "utf8")
    const src = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)?.[1]
    expect(src).toMatch(/^\/assets\/index-.+\.js$/)

    const entry = join(root, "dist", src!)
    const js = await readFile(entry, "utf8")
    // 런타임 import가 플러그인에 의해 풀려 번들 안에 들어갔다
    expect(js).not.toContain("mzscript/runtime")
    expect(js).toContain("toError")

    const g = globalThis as { 결과?: unknown }
    delete g.결과
    await import(pathToFileURL(entry).href)
    expect(g.결과).toEqual({ 합: 3, 메시지: "터졌다" })
  })

  it("소스맵이 .mz 원본을 가리킨다", async () => {
    const root = await makeProject({ "index.html": INDEX_HTML, "main.mz": MAIN_HN, "util.mz": UTIL_HN })
    await buildProject(root)

    const assets = await readdir(join(root, "dist/assets"))
    const mapFile = assets.find(name => name.endsWith(".js.map"))
    expect(mapFile).toBeDefined()
    const map = JSON.parse(await readFile(join(root, "dist/assets", mapFile!), "utf8")) as {
      sources: string[]
      sourcesContent: string[]
    }
    expect(map.sources).toEqual(expect.arrayContaining(["../../main.mz", "../../util.mz"]))
    expect(map.sourcesContent).toContain(MAIN_HN)
  })

  it("컴파일 에러를 .mz 파일·줄·칸, 코드 조각과 함께 던진다", async () => {
    const bad = BAD_HN
    const root = await makeProject({ "index.html": INDEX_HTML, "main.mz": bad })

    const error = await buildProject(root).then(
      () => {
        throw new Error("빌드가 실패해야 한다")
      },
      (err: unknown) => {
        // Vite 8(rolldown)은 플러그인 에러를 errors 배열에 모아 던진다
        const { errors } = err as { errors?: unknown[] }
        return (errors?.[0] ?? err) as BuildError
      },
    )
    // Vite는 모듈 경로를 OS와 상관없이 /로 넘긴다(Windows에서도 D:/a/...). 기대값도 같은 형식으로 맞춘다
    const file = normalizePath(join(root, "main.mz"))
    // id는 Vite 8에서 main.mz, Vite 7에서는 에러를 다시 감싼 index.html이다. 위치는 loc.file에 남는다
    expect(error.loc?.file).toBe(file)
    expect(error.loc?.line).toBe(3)
    expect(error.loc?.column).toBe(2)
    expect(error.frame).toBe("3 |   아! 줴줴이야 첫줄\n      ^")
    expect(error.message).toContain("main.mz:3:3")
  })
})

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer()
    srv.once("error", reject)
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address()
      srv.close(() => resolve(typeof address === "object" && address ? address.port : 0))
    })
  })
}

describe("dev 서버", () => {
  let server: ViteDevServer | undefined

  afterAll(async () => {
    await server?.close()
  })

  it(".mz 요청에 변환된 JS를 돌려주고, 런타임과 HMR이 동작한다", async () => {
    const root = await makeProject({ "index.html": INDEX_HTML, "main.mz": MAIN_HN, "util.mz": UTIL_HN })
    const port = await freePort()
    server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [mzscript()],
      server: { host: "127.0.0.1", port, strictPort: true },
    })
    await server.listen()
    const base = `http://127.0.0.1:${port}`

    const html = await (await fetch(`${base}/`)).text()
    expect(html).toContain(`src="./main.mz"`)

    // 브라우저는 <script> 요청에 Sec-Fetch-Dest: script를 붙이고, Vite는 이 헤더를 보고 변환한다
    const mainRes = await fetch(`${base}/main.mz`, { headers: { "sec-fetch-dest": "script" } })
    expect(mainRes.status).toBe(200)
    expect(mainRes.headers.get("content-type")).toMatch(/javascript/)
    const mainJs = await mainRes.text()
    expect(mainJs).toContain("let 메시지")
    expect(mainJs).not.toContain("진~지?")

    // main.mz가 가져가는 util.mz도 JS로 내준다
    const utilUrl = mainJs.match(/from "([^"]*util\.mz[^"]*)"/)?.[1]
    expect(utilUrl).toBeDefined()
    const utilJs = await (await fetch(`${base}${utilUrl}`)).text()
    expect(utilJs).toContain("__mz.toError(")

    // mzscript/runtime이 core 런타임의 실제 파일로 풀려서 브라우저가 받을 수 있다
    const runtimeUrl = utilJs.match(/import \{ __mz \} from "([^"]+)"/)?.[1]
    expect(runtimeUrl).toBeDefined()
    expect(runtimeUrl).toContain(RUNTIME_PATH.replace(/\\/g, "/"))
    const runtimeRes = await fetch(`${base}${runtimeUrl}`)
    expect(runtimeRes.status).toBe(200)
    expect(await runtimeRes.text()).toContain("toError")

    // .mz 파일을 고치면 HMR 채널로 갱신(update 또는 full-reload)을 알린다
    const token = (server.config as { webSocketToken?: string }).webSocketToken
    const ws = new WebSocket(`ws://127.0.0.1:${port}/${token ? `?token=${token}` : ""}`, "vite-hmr")
    const messages: { type: string }[] = []
    ws.addEventListener("message", event => messages.push(JSON.parse(String(event.data))))
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve())
      ws.addEventListener("error", () => reject(new Error("HMR 웹소켓 연결 실패")))
    })

    await writeFile(join(root, "util.mz"), UTIL_HN.replace("a + b", "a + b + 1"))
    await expect
      .poll(() => messages.find(m => m.type === "update" || m.type === "full-reload"), { timeout: 5000 })
      .toBeDefined()
    ws.close()

    const changed = await (await fetch(`${base}${utilUrl}`)).text()
    expect(changed).toContain("a + b + 1")
  })

  it("컴파일 에러를 파일·줄 정보와 함께 넘긴다", async () => {
    const bad = BAD_HN
    const root = await makeProject({ "index.html": INDEX_HTML, "main.mz": bad })
    const dev = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [mzscript()],
      server: { middlewareMode: true, hmr: false },
    })
    try {
      const error = await dev.transformRequest("/main.mz").then(
        () => {
          throw new Error("변환이 실패해야 한다")
        },
        (err: unknown) => err as { id?: string; loc?: { file?: string; line: number }; frame?: string },
      )
      expect(error.id).toBe(normalizePath(join(root, "main.mz")))
      expect(error.loc?.file).toBe(normalizePath(join(root, "main.mz")))
      expect(error.frame).toMatch(new RegExp(`^${error.loc?.line} \\| `))
    } finally {
      await dev.close()
    }
  })
})
