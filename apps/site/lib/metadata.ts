import type { Metadata } from "next"
import { appName } from "./shared"

// 페이지마다 canonical 주소와 Open Graph·Twitter 카드를 함께 채운다.
// 하위 페이지의 openGraph는 상위 값과 합쳐지지 않고 통째로 바뀌므로, 공통 값도 여기서 매번 넣는다
export function pageMetadata({
  title,
  description,
  path,
  image = "/opengraph-image",
}: {
  title?: string
  description: string
  path: string
  image?: string
}): Metadata {
  const ogTitle = title ? `${title} | ${appName}` : `${appName} (hannam-lang)`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: appName,
      locale: "ko_KR",
      url: path,
      title: ogTitle,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [image],
    },
  }
}

// 문서 페이지의 Open Graph 이미지 주소 (app/og/docs/[...slug]/route.tsx)
export function docsOgImage(slugs: string[]) {
  return `/og/docs/${[...slugs, "image.png"].join("/")}`
}
