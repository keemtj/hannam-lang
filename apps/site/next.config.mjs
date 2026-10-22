import { createMDX } from "fumadocs-mdx/next"

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 두 패키지 모두 TypeScript 소스를 그대로 export하므로 Next가 직접 변환한다
  transpilePackages: ["@hannam-lang/playground", "@hannam-lang/core"],
}

export default withMDX(config)
