// Node 모듈 커스터마이즈 훅: .hn 파일을 메모리에서 JS로 변환해 ES 모듈로 넘긴다
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { transform } from "./transform.js"

// 사용자 프로젝트에 hannam-lang이 따로 없어도 되도록 이 패키지의 런타임을 절대 URL로 가리킨다
const RUNTIME = new URL("./runtime.js", import.meta.url).href

/** @type {import("node:module").LoadHook} */
export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || !new URL(url).pathname.endsWith(".hn")) return nextLoad(url, context)
  const filename = fileURLToPath(url)
  const source = await readFile(filename, "utf8")
  return { format: "module", source: transform(source, filename, RUNTIME), shortCircuit: true }
}
