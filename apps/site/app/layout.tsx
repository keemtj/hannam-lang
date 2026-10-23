import { RootProvider } from "fumadocs-ui/provider/next"
import type { Metadata } from "next"
import { Black_Han_Sans } from "next/font/google"
import { koTranslations } from "@/lib/i18n-ko"
// 본문 글꼴. 페이지에 쓰인 글자 범위의 파일만 내려받는 dynamic subset 판이다
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
import "./global.css"

// 키워드 글자를 크게 보여 줄 때 쓰는 제목용 글꼴
const display = Black_Han_Sans({
  weight: "400",
  preload: false,
  variable: "--font-display",
})

export const metadata: Metadata = {
  title: {
    default: "엠지스크립트 (mzscript)",
    template: "%s | 엠지스크립트",
  },
  description: "그냥 JavaScript입니다. 말투만 다릅니다. .mz로 쓰고 JS로 바꿔 브라우저와 Node에서 실행합니다.",
}

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={display.variable} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          i18n={{ locale: "ko", translations: koTranslations }}
          search={{
            options: { api: "/api/search" },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
