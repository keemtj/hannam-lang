// 변환된 코드가 `import { __mz } from "mzscript/runtime"`으로 가져가는 헬퍼

type ReadSync = (fd: number, buffer: Uint8Array) => number

export const __mz = {
  /** 타입을 모르는 값을 throw할 때: 문자열이면 Error로 감싸고, 그 외는 그대로 */
  toError(value: unknown): unknown {
    return typeof value === "string" ? new Error(value) : value
  },

  /** 예/아니오 확인. 브라우저는 window.confirm, Node는 터미널에서 y/n을 동기로 입력받는다 */
  confirm(question: unknown): boolean {
    const g = globalThis as { confirm?: (q?: string) => boolean; process?: NodeLikeProcess }
    if (typeof g.confirm === "function") return g.confirm(String(question))
    const proc = g.process
    const fs = proc?.getBuiltinModule?.("node:fs") as { readSync: ReadSync } | undefined
    if (!proc || !fs) throw new Error("이 환경에서는 '예? 무슨 발언이세요?'(confirm)를 쓸 수 없습니다")
    proc.stdout.write(`${String(question)} (y/n) `)
    return /^\s*(y|yes|예|네|ㅇ)/i.test(readLineSync(fs.readSync))
  },
}

interface NodeLikeProcess {
  stdout: { write(text: string): unknown }
  getBuiltinModule?(id: string): unknown
}

function readLineSync(readSync: ReadSync): string {
  const bytes: number[] = []
  const buf = new Uint8Array(1)
  for (;;) {
    let n: number
    try {
      n = readSync(0, buf)
    } catch (e) {
      if ((e as { code?: string }).code === "EAGAIN") continue
      throw e
    }
    if (n === 0 || buf[0] === 0x0a) break
    bytes.push(buf[0]!)
  }
  return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\r$/, "")
}
