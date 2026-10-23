import { parse } from "acorn"

type AnyNode = { type: string; start: number; end: number; [key: string]: unknown }

const LOOPS = new Set(["ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement"])

/**
 * 반복문 몸체 맨 앞에 `__mz_loop();`를 넣어 iframe 안에서 무한 루프를 끊을 수 있게 한다.
 * 같은 줄 안에서만 글자를 넣으므로 줄 번호는 그대로다.
 * 파싱에 실패하면 원본을 돌려준다 (실행하면 같은 SyntaxError가 콘솔에 나온다).
 */
export function instrumentLoops(code: string): string {
  let ast: AnyNode
  try {
    ast = parse(code, { ecmaVersion: "latest", sourceType: "module" }) as unknown as AnyNode
  } catch {
    return code
  }

  const inserts: { at: number; text: string }[] = []
  walk(ast, (node) => {
    if (!LOOPS.has(node.type)) return
    const body = node.body as AnyNode
    if (body.type === "BlockStatement") {
      inserts.push({ at: body.start + 1, text: "__mz_loop();" })
    } else {
      inserts.push({ at: body.start, text: "{__mz_loop();" }, { at: body.end, text: "}" })
    }
  })

  // 뒤에서부터 넣어야 앞쪽 위치가 밀리지 않는다
  inserts.sort((a, b) => b.at - a.at)
  let out = code
  for (const { at, text } of inserts) out = out.slice(0, at) + text + out.slice(at)
  return out
}

function walk(node: AnyNode, visit: (node: AnyNode) => void): void {
  visit(node)
  for (const key of Object.keys(node)) {
    const child = node[key]
    if (Array.isArray(child)) {
      for (const c of child) if (isNode(c)) walk(c, visit)
    } else if (isNode(child)) {
      walk(child, visit)
    }
  }
}

function isNode(value: unknown): value is AnyNode {
  return typeof value === "object" && value !== null && typeof (value as AnyNode).type === "string"
}
