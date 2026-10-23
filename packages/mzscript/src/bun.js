// `bun --preload mzscript/bun app.mz`: Bun 런타임용 .mz 플러그인
// Node 로더 훅(module.register)은 Bun에서 동작하지 않으므로 Bun.plugin으로 따로 등록한다
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { transform } from "./transform.js"

const RUNTIME = fileURLToPath(new URL("./runtime.js", import.meta.url))

/** @type {any} */
const Bun = /** @type {any} */ (globalThis).Bun
if (!Bun) throw new Error("mzscript/bun은 Bun 런타임에서만 쓸 수 있습니다. Node에서는 mzscript/register를 쓰세요")

Bun.plugin({
  name: "mzscript",
  /** @param {any} build */
  setup(build) {
    build.onLoad({ filter: /\.mz$/ }, async (/** @type {{ path: string }} */ { path }) => {
      const source = await readFile(path, "utf8")
      return { contents: transform(source, path, RUNTIME), loader: "js" }
    })
  },
})
