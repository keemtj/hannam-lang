import type { Metadata } from "next"
import { ThemedPlayground } from "@/components/playground-client"

export const metadata: Metadata = {
  title: "Playground",
  description: ".hn 코드를 쓰면 바로 JS로 바꿔 보여 주고 브라우저 샌드박스에서 실행한다.",
}

export default function PlaygroundPage() {
  return (
    <main className="hn-playground-page">
      <ThemedPlayground syncUrl height="calc(100dvh - 7.5rem)" />
    </main>
  )
}
