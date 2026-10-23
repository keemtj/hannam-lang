import { ogImage, ogSize } from "@/lib/og"

export const alt = "한남랭: 그냥 JavaScript입니다. 말투만 한남입니다."
export const size = ogSize
export const contentType = "image/png"

export default function Image() {
  return ogImage({
    title: ["그냥 JavaScript입니다.", "말투만 한남입니다."],
    description: ".hn으로 쓰고 JS로 바꿔 브라우저와 Node에서 실행합니다.",
  })
}
