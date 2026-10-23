"use client"

// Playground 번들(CodeMirror, acorn, core)은 크기가 커서 쓰는 페이지에서만 브라우저 쪽으로 불러온다
import dynamic from "next/dynamic"
import type { PlaygroundProps } from "@mzscript/playground"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

const Playground = dynamic(() => import("@mzscript/playground").then((m) => m.Playground), {
  ssr: false,
  loading: () => <PlaygroundSkeleton />,
})

function PlaygroundSkeleton() {
  return (
    <div className="hn-pg-skeleton" role="status">
      Playground 불러오는 중…
    </div>
  )
}

/** 사이트 테마(라이트·다크)를 따라가는 Playground */
export function ThemedPlayground(props: Omit<PlaygroundProps, "theme">) {
  const { resolvedTheme } = useTheme()
  // 서버 렌더링과 첫 렌더링 결과를 맞추려고 마운트 뒤에만 테마를 넘긴다
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const theme = mounted && (resolvedTheme === "dark" || resolvedTheme === "light") ? resolvedTheme : "system"
  return <Playground {...props} theme={theme} />
}
