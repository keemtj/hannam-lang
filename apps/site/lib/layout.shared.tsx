import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { Logo } from "@/components/logo"
import { githubUrl } from "./shared"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
    },
    links: [
      { text: "문서", url: "/docs", active: "nested-url" },
      { text: "Playground", url: "/playground" },
    ],
    githubUrl,
  }
}
