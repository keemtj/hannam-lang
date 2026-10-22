import { afterEach, describe, expect, it } from "vitest"
import { compile } from "../src/index.js"
import { __hn } from "../src/runtime.js"

// 변환한 코드를 실제로 실행해서 동작을 확인한다
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>

async function run(source: string): Promise<unknown[]> {
  const code = compile(source).code.replace(/^import \{ __hn \} from .*$/m, "")
  const logs: unknown[] = []
  const fakeConsole = { log: (...args: unknown[]) => logs.push(args.length === 1 ? args[0] : args) }
  await new AsyncFunction("__hn", "console", code)(__hn, fakeConsole)
  return logs
}

describe("실행 결과", () => {
  afterEach(() => {
    delete (globalThis as { confirm?: unknown }).confirm
  })

  it("예??? 갈래 안의 줴줴이야는 바깥 반복문을 빠져나간다", async () => {
    const logs = await run(`
요이~ x [1, 2, 3] {
  예??? x {
    2 { 줴줴이야 }
  }
  무슨 발언이세요? x
}`)
    expect(logs).toEqual([1])
  })

  it("예??? 갈래 안의 아뇨는 다음 반복으로 넘어간다", async () => {
    const logs = await run(`
요이~ x [1, 2, 3] {
  예??? x {
    2 { 아뇨 }
  }
  무슨 발언이세요? x
}`)
    expect(logs).toEqual([1, 3])
  })

  it("예???는 값을 한 번만 평가하고, 쉼표 갈래와 기본 갈래가 동작한다", async () => {
    const logs = await run(`
엄. 횟수 = 0
티-원 값() {
  횟수++
  아! 줴줴이야~ "보관"
}
예??? 값() {
  "완료", "보관" { 무슨 발언이세요? "완료류" }
  아뇨아뇨아뇨아뇨 { 무슨 발언이세요? "기타" }
}
무슨 발언이세요? 횟수`)
    expect(logs).toEqual(["완료류", 1])
  })

  it("범위 반복은 끝을 포함하지 않는다", async () => {
    const logs = await run(`
요이~ i 0..3 {
  무슨 발언이세요? i
}`)
    expect(logs).toEqual([0, 1, 2])
  })

  it("문자열 throw는 Error 객체가 된다", async () => {
    const logs = await run(`
진~지? {
  아... 줴줴이야... "빈 할 일"
} 지~랄 e {
  무슨 발언이세요? e instanceof Error, e.message
}`)
    expect(logs).toEqual([[true, "빈 할 일"]])
  })

  it("변수로 던진 문자열도 Error가 되고, Error는 그대로 던져진다", async () => {
    const logs = await run(`
요이~ 값 ["문자열", new TypeError("타입")] {
  진~지? {
    아... 줴줴이야... 값
  } 지~랄 e {
    무슨 발언이세요? e.constructor.name, e.message
  }
}`)
    expect(logs).toEqual([
      ["Error", "문자열"],
      ["TypeError", "타입"],
    ])
  })

  it("클래스와 상속", async () => {
    const logs = await run(`
오호호호호~ 할일 {
  constructor(내용) { this.내용 = 내용 }
  설명() { 아! 줴줴이야~ this.내용 }
}
오호호호홋~ 마감할일 할일 {
  설명() { 아! 줴줴이야~ \`\${super.설명()} (마감)\` }
}
무슨 발언이세요? new 마감할일("보고서").설명()`)
    expect(logs).toEqual(["보고서 (마감)"])
  })

  it("async 함수와 템플릿 안의 await", async () => {
    const logs = await run(`
티~원 두배(x) {
  아! 줴줴이야~ x * 2
}
무슨 발언이세요? \`결과 \${티~원! 두배(21)}\``)
    expect(logs).toEqual(["결과 42"])
  })

  it("confirm은 브라우저의 confirm을 부른다", async () => {
    ;(globalThis as { confirm?: (q: string) => boolean }).confirm = (q) => q === "지울까요?"
    const logs = await run(`
예? 예? 무슨 발언이세요?("지울까요?") {
  무슨 발언이세요? "지움"
}`)
    expect(logs).toEqual(["지움"])
  })

  it("while과 else if 체인", async () => {
    const logs = await run(`
엄. n = 0
요이이이~ n < 5 {
  n++
  예? n % 2 === 0 {
    아뇨
  } 예?? n === 5 {
    무슨 발언이세요? "끝"
  } 아뇨아뇨아뇨아뇨 {
    무슨 발언이세요? n
  }
}`)
    expect(logs).toEqual([1, 3, "끝"])
  })
})
