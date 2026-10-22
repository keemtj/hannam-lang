// 개발·확인용 페이지. 문서 사이트의 /playground 페이지와 같은 설정으로 띄운다
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Playground } from "../src"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Playground syncUrl height="calc(100vh - 70px)" />
  </StrictMode>,
)
