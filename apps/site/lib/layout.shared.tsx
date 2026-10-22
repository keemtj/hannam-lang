import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { appName, githubUrl } from "./shared"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2 font-bold">
          <span className="hn-logo" aria-hidden>
            엄.
          </span>
          {appName}
        </span>
      ),
    },
    links: [
      { text: "문서", url: "/docs", active: "nested-url" },
      { text: "Playground", url: "/playground" },
    ],
    githubUrl,
  }
}
