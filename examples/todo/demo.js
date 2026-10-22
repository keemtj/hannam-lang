// 투두 데모의 서버(hannam)와 웹(Vite)을 함께 띄운다. 레포 루트에서 `pnpm demo`로 실행한다.
//
// PORT 환경변수로 서버 포트를 바꾸면 웹의 /api/ 프록시(TODO_API_PORT)도 같은 포트를 본다. 기본값은 3100.
// 둘 중 하나가 끝나거나 Ctrl+C를 누르면 나머지도 함께 끝낸다.
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../..", import.meta.url))
const port = process.env.PORT ?? "3100"
const env = { ...process.env, PORT: port, TODO_API_PORT: port }

const children = [
  spawn(process.execPath, ["packages/hannam-lang/bin/hannam.js", "examples/todo/server/server.hn"], {
    cwd: root,
    env,
    stdio: "inherit",
  }),
  // Windows에서는 pnpm이 pnpm.cmd라서 셸을 거쳐야 실행된다
  spawn("pnpm", ["--filter", "@hannam-lang/example-todo-web", "dev"], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
]

let stopping = false
function stopAll(code) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null) child.kill()
  }
  process.exitCode = code
}

for (const child of children) {
  child.on("exit", (code) => stopAll(code ?? 0))
  child.on("error", (error) => {
    console.error(error.message)
    stopAll(1)
  })
}
process.on("SIGINT", () => stopAll(0))
process.on("SIGTERM", () => stopAll(0))
