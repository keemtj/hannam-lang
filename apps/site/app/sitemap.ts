import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/shared"
import { source } from "@/lib/source"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, priority: 1 },
    { url: `${siteUrl}/playground`, priority: 0.8 },
    ...source.getPages().map((page) => ({ url: `${siteUrl}${page.url}`, priority: 0.7 })),
  ]
}
