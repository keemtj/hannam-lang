// 메인 페이지 "밈 11개" 목록. 뉘앙스는 docs/hannam-lang-context.md의 원본 정의를 따른다.
export interface Meme {
  meme: string
  nuance: string
  syntax: { hn: string; js: string }[]
  href: string
}

export const MEMES: Meme[] = [
  {
    meme: "엄.",
    nuance: "할 말 없을 때, 생각할 때 거의 모든 추임새의 시작",
    syntax: [
      { hn: "엄 / 엄. / 엄..", js: "var / let / const" },
      { hn: "엄...", js: "// 주석" },
    ],
    href: "/docs/syntax/variables",
  },
  {
    meme: "예?",
    nuance: "물음표가 늘어날수록 더 되묻는 의문문",
    syntax: [
      { hn: "예? / 예??", js: "if / else if" },
      { hn: "예???", js: "switch" },
    ],
    href: "/docs/syntax/conditionals",
  },
  {
    meme: "아뇨아뇨아뇨아뇨",
    nuance: "부정. 기본은 딱 네 번",
    syntax: [{ hn: "아뇨아뇨아뇨아뇨", js: "else / default" }],
    href: "/docs/syntax/conditionals",
  },
  {
    meme: "요이~",
    nuance: "기분 좋을 때. 물결은 항상 맨 뒤",
    syntax: [
      { hn: "요이~ 항목 목록", js: "for...of" },
      { hn: "요이이이~", js: "while" },
    ],
    href: "/docs/syntax/loops",
  },
  {
    meme: "요히~",
    nuance: "요이의 '이'를 '히'로 바꾼 짝꿍",
    syntax: [{ hn: "요히~ 키 객체", js: "for...in" }],
    href: "/docs/syntax/loops",
  },
  {
    meme: "줴줴이야",
    nuance: "GG에서 변형. 이겼을 때도 졌을 때도",
    syntax: [
      { hn: "줴줴이야 / 아뇨", js: "break / continue" },
      { hn: "아! 줴줴이야~", js: "return" },
      { hn: "아... 줴줴이야...", js: "throw" },
    ],
    href: "/docs/syntax/functions",
  },
  {
    meme: "티-원",
    nuance: "LoL 팀 T1에서 유래. 티와 원 사이에 - 또는 ~",
    syntax: [
      { hn: "티-원 / 티~원", js: "function / async function" },
      { hn: "티~원!", js: "await" },
    ],
    href: "/docs/syntax/functions",
  },
  {
    meme: "진~지?",
    nuance: "장난쳤는데 진지하게 받으면 하는 리액션",
    syntax: [{ hn: "진~지? {", js: "try {" }],
    href: "/docs/syntax/exceptions",
  },
  {
    meme: "지~랄",
    nuance: "누가 말하면 \"아 진짜?\" 하고 받아 주는 말",
    syntax: [{ hn: "} 지~랄 e {", js: "} catch (e) {" }],
    href: "/docs/syntax/exceptions",
  },
  {
    meme: "오호호호호~",
    nuance: "한국 남자 웃음소리. 오콧콧콧과 오홋홋홋 사이",
    syntax: [
      { hn: "오호호호호~", js: "class" },
      { hn: "오호호호홋~", js: "class extends" },
    ],
    href: "/docs/syntax/classes",
  },
  {
    meme: "무슨 발언이세요?",
    nuance: "상대 말이 황당하고 어이없을 때",
    syntax: [
      { hn: "무슨 발언이세요? 값", js: "console.log" },
      { hn: "예? 무슨 발언이세요?()", js: "confirm" },
    ],
    href: "/docs/syntax/output",
  },
]
