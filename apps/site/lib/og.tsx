import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { LOGO_BODY, LOGO_HEIGHT, LOGO_TAIL, LOGO_VIEWBOX, LOGO_WIDTH } from "@/components/logo"

// Open Graph 이미지(1200×630). 빌드할 때 한 번 만들어 정적 파일로 내보낸다.
// 기본 글꼴에는 한글이 없어서 Pretendard OTF를 직접 읽어 넘긴다 (ImageResponse는 woff2를 못 읽는다)
const fontDir = join(process.cwd(), "node_modules/pretendard/dist/public/static")
const fonts = Promise.all([
  readFile(join(fontDir, "Pretendard-Medium.otf")),
  readFile(join(fontDir, "Pretendard-ExtraBold.otf")),
])

export const ogSize = { width: 1200, height: 630 }

const ink = "#18181b"
const muted = "#52525b"
const accent = "#e11d48"
const surface = "#fffafa"

export async function ogImage({ eyebrow, title, description }: { eyebrow?: string; title: string | string[]; description?: string }) {
  const [medium, extraBold] = await fonts
  const logoHeight = 64
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: surface,
        borderTop: `12px solid ${accent}`,
        fontFamily: "Pretendard",
      }}
    >
      <svg height={logoHeight} width={(logoHeight * LOGO_WIDTH) / LOGO_HEIGHT} viewBox={LOGO_VIEWBOX}>
        <path d={LOGO_BODY} fill={ink} />
        <path d={LOGO_TAIL} fill={accent} />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {eyebrow ? <div style={{ fontSize: 32, fontWeight: 500, color: accent }}>{eyebrow}</div> : null}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 72,
            fontWeight: 800,
            color: ink,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
          }}
        >
          {/* 배열이면 한 줄씩 끊어서 단어 중간에서 줄이 바뀌지 않게 한다 */}
          {(Array.isArray(title) ? title : [title]).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        {description ? (
          <div style={{ fontSize: 32, fontWeight: 500, color: muted, lineHeight: 1.45 }}>{description}</div>
        ) : null}
      </div>
    </div>,
    {
      ...ogSize,
      fonts: [
        { name: "Pretendard", data: medium, weight: 500, style: "normal" },
        { name: "Pretendard", data: extraBold, weight: 800, style: "normal" },
      ],
    },
  )
}
