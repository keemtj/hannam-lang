import { readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"
import { compile } from "../src/index.js"

// 상위 호환 검사: 한남랭 키워드가 없는 실제 JS는 출력이 입력과 한 글자도 달라지지 않아야 한다.
// 글자가 같으면 의미도 같으므로, 출력이 올바른 JS인지만 보는 것보다 강한 조건이다.
// 표본은 버전을 고정한 패키지의 배포 파일이다 (package.json의 정확한 버전과 lockfile로 고정)
const require = createRequire(import.meta.url)
const CORPUS = ["acorn", "magic-string", "lodash-es"]

function packageDir(name: string): string {
  return dirname(require.resolve(`${name}/package.json`))
}

function jsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(c|m)?js$/.test(e.name))
    .map((e) => join(e.parentPath, e.name))
    .sort()
}

describe("상위 호환: 키워드가 없는 JS는 그대로 통과한다", () => {
  for (const name of CORPUS) {
    it(name, () => {
      const files = jsFiles(packageDir(name))
      expect(files.length).toBeGreaterThan(0)
      const changed = files.filter((file) => {
        const source = readFileSync(file, "utf8")
        return compile(source, { filename: file }).code !== source
      })
      expect(changed).toEqual([])
    })
  }
})
