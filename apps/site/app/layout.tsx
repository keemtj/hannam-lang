import { RootProvider } from "fumadocs-ui/provider/next"
import type { Metadata } from "next"
import "./global.css"

export const metadata: Metadata = {
  title: {
    default: "한남랭 (hannam-lang)",
    template: "%s | 한남랭",
  },
  description: "한남 말투 밈 11개로 쓰는 JS 상위 호환 언어. .hn으로 쓰고 JS로 바꿔 브라우저와 Node에서 실행한다.",
}

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
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
