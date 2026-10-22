// 메인 페이지의 키워드 → JS 대응 목록
export interface Keyword {
  word: string
  syntax: { hn: string; js: string }[]
  href: string
}

export const KEYWORDS: Keyword[] = [
  {
    word: "엄.",
    syntax: [
      { hn: "엄 / 엄. / 엄..", js: "var / let / const" },
      { hn: "엄...", js: "// 주석" },
    ],
    href: "/docs/syntax/variables",
  },
  {
    word: "예?",
    syntax: [
      { hn: "예? / 예??", js: "if / else if" },
      { hn: "예???", js: "switch" },
    ],
    href: "/docs/syntax/conditionals",
  },
  {
    word: "아뇨아뇨아뇨아뇨",
    syntax: [{ hn: "아뇨아뇨아뇨아뇨", js: "else / default" }],
    href: "/docs/syntax/conditionals",
  },
  {
    word: "요이~",
    syntax: [
      { hn: "요이~ 항목 목록", js: "for...of" },
      { hn: "요이이이~", js: "while" },
    ],
    href: "/docs/syntax/loops",
  },
  {
    word: "요히~",
    syntax: [{ hn: "요히~ 키 객체", js: "for...in" }],
    href: "/docs/syntax/loops",
  },
  {
    word: "줴줴이야",
    syntax: [
      { hn: "줴줴이야 / 아뇨", js: "break / continue" },
      { hn: "아! 줴줴이야~", js: "return" },
      { hn: "아... 줴줴이야...", js: "throw" },
    ],
    href: "/docs/syntax/functions",
  },
  {
    word: "티-원",
    syntax: [
      { hn: "티-원 / 티~원", js: "function / async function" },
      { hn: "티~원!", js: "await" },
    ],
    href: "/docs/syntax/functions",
  },
  {
    word: "진~지?",
    syntax: [{ hn: "진~지? {", js: "try {" }],
    href: "/docs/syntax/exceptions",
  },
  {
    word: "지~랄",
    syntax: [{ hn: "} 지~랄 e {", js: "} catch (e) {" }],
    href: "/docs/syntax/exceptions",
  },
  {
    word: "오호호호호~",
    syntax: [
      { hn: "오호호호호~", js: "class" },
      { hn: "오호호호홋~", js: "class extends" },
    ],
    href: "/docs/syntax/classes",
  },
  {
    word: "무슨 발언이세요?",
    syntax: [
      { hn: "무슨 발언이세요? 값", js: "console.log" },
      { hn: "예? 무슨 발언이세요?()", js: "confirm" },
    ],
    href: "/docs/syntax/output",
  },
]
