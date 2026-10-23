// CLI는 빌드된 core(dist)를 쓰므로, 없으면 테스트 전에 한 번 빌드한다
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

export default function setup() {
  const core = fileURLToPath(new URL("../../core", import.meta.url))
  if (existsSync(`${core}/dist/index.js`)) return
  execFileSync("pnpm", ["run", "build"], { cwd: core, stdio: "inherit" })
}
