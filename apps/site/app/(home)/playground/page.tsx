import type { Metadata } from "next"
import { ThemedPlayground } from "@/components/playground-client"
import { pageMetadata } from "@/lib/metadata"
import { version } from "@/lib/version"

export const metadata: Metadata = pageMetadata({
  title: "Playground",
  description: ".hn 코드를 쓰면 바로 JS로 바꿔 보여 주고 브라우저 샌드박스에서 실행합니다.",
  path: "/playground",
})

export default function PlaygroundPage() {
  return (
    <main className="hn-playground-page">
      <p className="hn-playground-note">
        최근 배포 버전은 <a href="/docs/changelog">v{version}</a>입니다. Playground는 저장소의 최신 코드로 동작하므로, 아직 배포되지 않은
        변경이 먼저 들어 있을 수 있습니다.
      </p>
      <ThemedPlayground syncUrl height="calc(100dvh - 9.5rem)" />
    </main>
  )
}
