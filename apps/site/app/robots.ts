import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/shared"

// Vercel 미리 보기 배포는 검색에 잡히지 않게 막는다
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === "preview") {
    return { rules: { userAgent: "*", disallow: "/" } }
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
