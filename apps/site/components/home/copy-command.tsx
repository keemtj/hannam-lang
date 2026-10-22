"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"

/** 터미널 명령 한 줄과 복사 버튼 */
export function CopyCommand({ command, className = "" }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 클립보드 권한이 없으면 아무것도 하지 않는다
    }
  }

  return (
    <div className={`hn-command ${className}`}>
      <span className="hn-command-prompt" aria-hidden>
        $
      </span>
      <code>{command}</code>
      <button type="button" onClick={copy} aria-label={copied ? "복사됨" : "명령 복사"} className="hn-command-copy">
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  )
}
