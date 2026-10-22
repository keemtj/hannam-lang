import { compile } from "@hannam-lang/core"
import { ArrowRight, Blocks, Globe, Play, ShieldCheck } from "lucide-react"
import Link from "next/link"
import type { CSSProperties } from "react"
import { CopyCommand } from "@/components/home/copy-command"
import { InstallTabs } from "@/components/home/install-tabs"
import { highlight } from "@/lib/highlight"
import { KEYWORDS } from "@/lib/keywords"
import { umjunsikUrl } from "@/lib/shared"

const HERO_CODE = `티~원 할일불러오기() {
  진~지? {
    엄.. 응답 = 티~원! fetch("/api/todos")
    아! 줴줴이야~ 티~원! 응답.json()
  } 지~랄 e {
    무슨 발언이세요? "불러오기 실패:", e.message
    아! 줴줴이야~ []
  }
}

요이~ 할일 티~원! 할일불러오기() {
  예? 할일.완료 {
    아뇨
  }
  무슨 발언이세요? \`□ \${할일.내용}\`
}
`

// 배경에 흩뿌리는 한남 말투 말풍선
const FLOATING = ["예???", "아! 줴줴이야~", "오호호호호~", "진~지?", "엄...", "요이~", "지~랄", "티~원!"]

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "JS 상위 호환",
    body: "한남랭 키워드만 JS로 바뀌고 나머지는 그대로 통과합니다. ES2015 이후 문법, DOM, fetch, npm 패키지를 전부 그대로 씁니다.",
  },
  {
    icon: Globe,
    title: "브라우저와 Node 어디서나",
    body: "출력은 ES 모듈이라 브라우저, Node, Bun에서 실행됩니다. 소스맵 덕분에 에러 스택이 .hn 원본 줄을 가리킵니다.",
  },
  {
    icon: Blocks,
    title: "Vite · VS Code · Playground",
    body: "Vite 플러그인으로 웹 앱을 만들고, VS Code 확장으로 하이라이팅을 받고, Playground에서 설치 없이 실행합니다.",
  },
  {
    icon: Play,
    title: "친절한 컴파일 에러",
    body: "예???? 처럼 개수가 틀린 키워드, 휴대폰이 바꾼 둥근 따옴표까지 위치와 고칠 방법을 한국어로 알려 줍니다.",
  },
]

export default async function HomePage() {
  // JS 쪽은 실제 변환기 출력이다 (손으로 쓰지 않음)
  const js = compile(HERO_CODE, { filename: "todos.hn" }).code
  const [hnHtml, jsHtml] = await Promise.all([highlight(HERO_CODE.trimEnd(), "hn"), highlight(js.trimEnd(), "javascript")])

  return (
    <main className="hn-home">
      {/* 첫 화면 */}
      <section className="hn-hero">
        <div className="hn-floating" aria-hidden>
          {FLOATING.map((word, i) => (
            <span key={word} style={{ "--i": i } as CSSProperties}>
              {word}
            </span>
          ))}
        </div>

        <div className="hn-container hn-hero-inner">
          <p className="hn-badge">
            <span className="hn-badge-dot" /> JS 상위 호환 · .hn → .js
          </p>
          <h1 className="hn-title">
            한남 말투로 쓰는
            <br />
            <span className="hn-title-accent">진짜 JavaScript</span>
          </h1>
          <p className="hn-lead">
            그냥 JavaScript입니다. 말투만 한남입니다. <code>.hn</code>으로 쓰고 JS로 바꿔 브라우저와 Node에서 그대로
            실행하세요. 장난처럼 보여도 풀스택 투두 앱까지 만들 수 있습니다.
          </p>

          <div className="hn-hero-actions">
            <Link href="/docs/getting-started/installation" className="hn-btn hn-btn-primary">
              시작하기 <ArrowRight size={16} />
            </Link>
            <Link href="/playground" className="hn-btn hn-btn-ghost">
              <Play size={16} /> Playground에서 해 보기
            </Link>
          </div>
          <CopyCommand command="npm i -D hannam-lang" className="hn-hero-command" />
        </div>

        <div className="hn-container">
          <div className="hn-compare">
            <figure className="hn-window">
              <figcaption>
                <span className="hn-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                todos.hn
              </figcaption>
              <div className="hn-code" dangerouslySetInnerHTML={{ __html: hnHtml }} />
            </figure>
            <div className="hn-compare-arrow" aria-hidden>
              <span>hannamc</span>
              <ArrowRight size={20} />
            </div>
            <figure className="hn-window">
              <figcaption>
                <span className="hn-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                todos.js
              </figcaption>
              <div className="hn-code" dangerouslySetInnerHTML={{ __html: jsHtml }} />
            </figure>
          </div>
        </div>
      </section>

      {/* 키워드 → JS */}
      <section className="hn-section" id="keywords">
        <div className="hn-container">
          <h2 className="hn-h2">
            한남 말투 → <span className="hn-title-accent">JavaScript</span>
          </h2>
          <p className="hn-sub">
            문장 맨 앞의 키워드만 바뀝니다. 점·물음표·글자 개수가 다르면 다른 문법이고, 정해진 개수를 벗어나면 컴파일
            에러로 알려 줍니다.
          </p>
          <ol className="hn-keywords">
            {KEYWORDS.map((m, i) => (
              <li key={m.word}>
                <Link href={m.href} className="hn-keyword">
                  <span className="hn-keyword-no">{String(i + 1).padStart(2, "0")}</span>
                  <span className="hn-keyword-word">{m.word}</span>
                  <span className="hn-keyword-map">
                    {m.syntax.map((s) => (
                      <span key={s.hn} className="hn-keyword-row">
                        <code className="hn-chip-hn">{s.hn}</code>
                        <ArrowRight size={14} aria-hidden />
                        <code className="hn-chip-js">{s.js}</code>
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 특징 */}
      <section className="hn-section hn-section-alt">
        <div className="hn-container">
          <h2 className="hn-h2">새 언어가 아니라, JavaScript 그대로</h2>
          <p className="hn-sub">
            엄랭이 &quot;만들 수 있냐&quot;를 묻는 퍼즐이었다면, 한남랭은 &quot;실제로 쓸 수 있냐&quot;를 목표로 합니다.
            타입도 실행 규칙도 JS 그대로이고, 바뀌는 것은 말투뿐입니다.
          </p>
          <div className="hn-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="hn-feature">
                <f.icon size={22} className="hn-feature-icon" aria-hidden />
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 설치 */}
      <section className="hn-section" id="install">
        <div className="hn-container hn-install">
          <div>
            <h2 className="hn-h2">설치는 한 줄</h2>
            <p className="hn-sub">
              <code>hannam-lang</code> 패키지 하나에 실행기 <code>hannam</code>, 컴파일러 <code>hannamc</code>, 런타임
              헬퍼가 모두 들어 있습니다. 쓰는 패키지 매니저를 고르세요.
            </p>
            <p className="hn-sub hn-small">
              아직 npm 배포 전입니다. 지금은 저장소에서 빌드해 쓸 수 있습니다.{" "}
              <Link href="/docs/getting-started/installation" className="hn-link">
                설치 문서 보기
              </Link>
            </p>
          </div>
          <InstallTabs />
        </div>
      </section>

      {/* Playground로 */}
      <section className="hn-cta">
        <div className="hn-container hn-cta-inner">
          <div>
            <p className="hn-cta-kicker">설치까지 하라고요? 진~지?</p>
            <h2>브라우저에서 바로 실행해 보세요</h2>
            <p>코드를 쓰면 변환된 JS가 옆에 나오고, 실행 결과가 콘솔에 찍힙니다. 공유 링크도 만들 수 있습니다.</p>
          </div>
          <Link href="/playground" className="hn-btn hn-btn-invert">
            Playground 열기 <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="hn-footer">
        <div className="hn-container hn-footer-inner">
          <p>
            <a href={umjunsikUrl} target="_blank" rel="noreferrer" className="hn-link">
              rycont/umjunsik-lang(엄랭)
            </a>
            에 영감을 받아 제작
          </p>
          <nav>
            <Link href="/docs">문서</Link>
            <Link href="/docs/syntax">문법</Link>
            <Link href="/playground">Playground</Link>
            <Link href="/docs/contributing">기여하기</Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}
