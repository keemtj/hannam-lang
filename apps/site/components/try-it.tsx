"use client"

import { ThemedPlayground } from "./playground-client"

interface TryItProps {
  /** 처음 보여 줄 .hn 코드 */
  code: string
  /** 높이(px). 기본 340 */
  height?: number
}

/** 문서 본문에 넣는 작은 "실행해 보기" 블록. 공유 링크는 /playground로 보낸다 */
export function TryIt({ code, height = 340 }: TryItProps) {
  return (
    <div className="hn-tryit not-prose">
      <div className="hn-tryit-label">실행해 보기</div>
      <ThemedPlayground initialCode={code} height={height} showExamples={false} shareBaseUrl="/playground" />
    </div>
  )
}
