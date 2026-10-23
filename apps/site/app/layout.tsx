import { RootProvider } from "fumadocs-ui/provider/next"
import type { Metadata } from "next"
import { Black_Han_Sans } from "next/font/google"
import { koTranslations } from "@/lib/i18n-ko"
import { pageMetadata } from "@/lib/metadata"
import { appName, siteDescription, siteUrl } from "@/lib/shared"
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
  ...pageMetadata({ description: siteDescription, path: "/" }),
  metadataBase: new URL(siteUrl),
  title: {
    default: `${appName} (hannam-lang)`,
    template: `%s | ${appName}`,
  },
  description: siteDescription,
  applicationName: appName,
  keywords: ["한남랭", "hannam-lang", "JavaScript", "컴파일러", "트랜스파일러", "Vite 플러그인", "Node", "Bun"],
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
