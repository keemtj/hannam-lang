import { RootProvider } from "fumadocs-ui/provider/next"
import type { Metadata } from "next"
import { Black_Han_Sans } from "next/font/google"
import { koTranslations } from "@/lib/i18n-ko"
import "./global.css"

// 밈 글자를 크게 보여 줄 때 쓰는 제목용 글꼴
const display = Black_Han_Sans({
  weight: "400",
  preload: false,
  variable: "--font-display",
})

export const metadata: Metadata = {
  title: {
    default: "한남랭 (hannam-lang)",
    template: "%s | 한남랭",
  },
  description: "한남 말투 밈 11개로 쓰는 JS 상위 호환 언어. .hn으로 쓰고 JS로 바꿔 브라우저와 Node에서 실행한다.",
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
