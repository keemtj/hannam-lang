function 할일추가(내용) {
  if (!내용.trim()) {
    throw new Error("빈 할 일")
  }
  할일들.push({ id: Date.now(), 내용, 완료: false })
  return 할일들.length
}

function 삭제(id) {
  if (!id) {
    return
  }
  할일들.splice(할일들.findIndex(할일 => 할일.id === id), 1)
}

async function 불러오기(url) {
  const 응답 = await fetch(url)
  if (!응답.ok) {
    throw new Error(`불러오기 실패 (${응답.status})`)
  }
  return await 응답.json()
}

function 던지기(에러) {
  if (에러 instanceof 검증에러) {
    throw new 검증에러("검증 실패")
  }
  throw __hn.toError(에러)
}

function 객체돌려주기() {
  return { ok: true }
}

export function 내보내기() {}
export default async function 기본() {}
import { __hn } from "hannam-lang/runtime"
