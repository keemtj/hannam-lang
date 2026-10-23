import { defineConfig } from "fumadocs-mdx/config"
import { hnLanguage } from "./lib/mz-grammar"

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: { light: "github-light", dark: "github-dark" },
      // 엠지스크립트 문법 정의에 Oniguruma 정규식이 있어 VS Code와 같은 엔진으로 칠한다
      engine: "oniguruma",
      langs: ["javascript", hnLanguage],
    },
  },
})
