// 서버 REST API 호출 모음
const 주소 = "/api/todos"

async function 요청(경로, 옵션 = {}) {
  const 응답 = await fetch(경로, {
    headers: { "Content-Type": "application/json" },
    ...옵션,
  })
  if (!응답.ok) {
    throw new Error(`요청 실패 (${응답.status})`)
  }
  return 응답.status === 204 ? null : await 응답.json()
}

export async function 목록가져오기() {
  return await 요청(주소)
}

export async function 추가하기(내용) {
  return await 요청(주소, { method: "POST", body: JSON.stringify({ 내용 }) })
}

export async function 토글하기(id) {
  return await 요청(`${주소}/${id}`, { method: "PATCH" })
}

export async function 삭제하기(id) {
  await 요청(`${주소}/${id}`, { method: "DELETE" })
}
