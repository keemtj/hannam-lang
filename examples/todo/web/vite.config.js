// 투두 웹 화면을 Vite로 띄운다. index.html이 main.mz를 바로 불러오고, .mz는 플러그인이 JS로 바꾼다.
//
// 실행 (레포 루트에서):
//   pnpm install
//   pnpm --filter @mzscript/core --filter @mzscript/vite-plugin build
//   TODO_API_PORT=3100 pnpm --filter @mzscript/example-todo-web dev
//
// /api 요청은 TODO_API_PORT 포트의 투두 서버(server/server.mz)로 넘긴다. 기본값은 3100이다.
import mzscript from "@mzscript/vite-plugin"
import { defineConfig } from "vite"

const apiPort = Number(process.env.TODO_API_PORT ?? 3100)

export default defineConfig({
  plugins: [mzscript()],
  server: {
    proxy: {
      // "/api"로 쓰면 접두어 매칭이라 화면 모듈 /api.mz 요청까지 서버로 가 버린다
      "/api/": `http://localhost:${apiPort}`,
    },
  },
})
