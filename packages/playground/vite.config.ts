import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// 개발·확인용 페이지(index.html → dev/main.tsx)를 띄우고 빌드한다.
// 컴포넌트 자체는 package.json의 exports(src/index.ts)로 문서 사이트에서 직접 가져간다.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5175, strictPort: true },
})
