import { notFound } from "next/navigation"
import { ogImage } from "@/lib/og"
import { source } from "@/lib/source"

// 문서 페이지마다 제목이 들어간 Open Graph 이미지. 주소는 /og/docs/<slug...>/image.png
export const dynamic = "force-static"

export async function GET(_req: Request, { params }: RouteContext<"/og/docs/[...slug]">) {
  const { slug } = await params
  const page = source.getPage(slug.slice(0, -1))
  if (!page) notFound()
  return ogImage({ eyebrow: "문서", title: page.data.title, description: page.data.description })
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: [...page.slugs, "image.png"] }))
}
