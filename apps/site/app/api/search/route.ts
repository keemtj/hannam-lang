import { createFromSource } from "fumadocs-core/search/server"
import { source } from "@/lib/source"

// 기본 multilingual 토크나이저가 한국어도 나눠 준다
export const { GET } = createFromSource(source)
