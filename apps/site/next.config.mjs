import { createMDX } from "fumadocs-mdx/next"

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 두 패키지 모두 TypeScript 소스를 그대로 export하므로 Next가 직접 변환한다
  transpilePackages: ["@hannam-lang/playground", "@hannam-lang/core"],
  // 설치한 Next.js 버전에 보안 공지가 나오면 코딩 에이전트에게 업그레이드를 알린다
  experimental: { agentUpgrade: "security" },
}

export default withMDX(config)
