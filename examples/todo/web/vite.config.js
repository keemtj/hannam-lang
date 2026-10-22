// 투두 웹 화면을 Vite로 띄운다. index.html이 main.hn을 바로 불러오고, .hn은 플러그인이 JS로 바꾼다.
//
// 실행 (레포 루트에서):
//   pnpm install
//   pnpm --filter @hannam-lang/core --filter @hannam-lang/vite-plugin build
//   TODO_API_PORT=3100 pnpm --filter @hannam-lang/example-todo-web dev
//
// /api 요청은 TODO_API_PORT 포트의 투두 서버(server/server.hn)로 넘긴다. 기본값은 3100이다.
import hannam from "@hannam-lang/vite-plugin"
import { defineConfig } from "vite"

const apiPort = Number(process.env.TODO_API_PORT ?? 3100)

export default defineConfig({
  plugins: [hannam()],
  server: {
    proxy: {
      // "/api"로 쓰면 접두어 매칭이라 화면 모듈 /api.hn 요청까지 서버로 가 버린다
      "/api/": `http://localhost:${apiPort}`,
    },
  },
})
