// 할 일 화면: 추가, 완료 토글, 삭제, 필터
import { 목록가져오기, 추가하기, 토글하기, 삭제하기 } from "./api.js"

const 폼 = document.querySelector("#새할일")
const 입력 = document.querySelector("#내용")
const 목록 = document.querySelector("#목록")
const 필터버튼들 = document.querySelectorAll("[data-filter]")

let 할일들 = []
let 필터 = "전체"

function 글자만(문자열) {
  const 칸 = document.createElement("span")
  칸.textContent = 문자열
  return 칸.innerHTML
}

function 보이는할일() {
  { const __hn_s0 = 필터;
    if (__hn_s0 === "전체") { return 할일들 }
    else if (__hn_s0 === "완료") { return 할일들.filter(할일 => 할일.완료) }
    else if (__hn_s0 === "남음") { return 할일들.filter(할일 => !할일.완료) }
  }
  throw new Error(`알 수 없는 필터: ${필터}`)
}

function 그리기() {
  목록.innerHTML = 보이는할일()
    .map(할일 => `
      <li data-id="${할일.id}" class="${할일.완료 ? "완료" : ""}">
        <input type="checkbox" ${할일.완료 ? "checked" : ""}>
        <span>${글자만(할일.내용)}</span>
        <button data-action="삭제">삭제</button>
      </li>`)
    .join("")
  for (const 버튼 of 필터버튼들) {
    버튼.classList.toggle("선택", 버튼.dataset.filter === 필터)
  }
}

폼.addEventListener("submit", async (e) => {
  e.preventDefault()
  const 내용 = 입력.value.trim()
  if (!내용) {
    return
  }
  try {
    할일들.push(await 추가하기(내용))
    입력.value = ""
    그리기()
  } catch (에러) {
    console.log("추가 실패:", 에러.message)
  }
})

목록.addEventListener("click", async (e) => {
  const 항목 = e.target.closest("li")
  if (!항목) {
    return
  }
  const id = Number(항목.dataset.id)

  try {
    if (e.target.matches("[data-action=삭제]")) {
      if (__hn.confirm("이 할 일을 지울까요?")) {
        await 삭제하기(id)
        할일들 = 할일들.filter(할일 => 할일.id !== id)
      }
    } else if (e.target.matches("input[type=checkbox]")) {
      const 바뀐것 = await 토글하기(id)
      할일들 = 할일들.map(할일 => 할일.id === id ? 바뀐것 : 할일)
    }
    그리기()
  } catch (에러) {
    console.log("변경 실패:", 에러.message)
  }
})

for (const 버튼 of 필터버튼들) {
  버튼.addEventListener("click", () => {
    필터 = 버튼.dataset.filter
    그리기()
  })
}

try {
  할일들 = await 목록가져오기()
  그리기()
} catch (에러) {
  console.log("불러오기 실패:", 에러.message)
}
import { __hn } from "hannam-lang/runtime"
