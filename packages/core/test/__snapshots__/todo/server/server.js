// 할 일 REST 서버 (node:http + JSON 파일 저장)
// GET /api/todos, POST /api/todos, PATCH /api/todos/:id (완료 토글), DELETE /api/todos/:id
import http from "node:http"
import { readFile, writeFile } from "node:fs/promises"

const 파일 = new URL("./todos.json", import.meta.url)
const 포트 = 3000

async function 불러오기() {
  try {
    return JSON.parse(await readFile(파일, "utf8"))
  } catch (에러) {
    if (에러.code === "ENOENT") {
      return []
    }
    throw __hn.toError(에러)
  }
}

async function 저장하기(할일들) {
  await writeFile(파일, JSON.stringify(할일들, null, 2))
}

async function 본문읽기(req) {
  let 본문 = ""
  for await (const 조각 of req) {
    본문 += 조각
  }
  return 본문 ? JSON.parse(본문) : {}
}

function 응답(res, 상태, 데이터) {
  res.writeHead(상태, { "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(데이터))
}

const 서버 = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`)
  const 일치 = pathname.match(/^\/api\/todos\/(\d+)$/)
  const id = 일치 ? Number(일치[1]) : null

  try {
    if (pathname === "/api/todos") {
      { const __hn_s0 = req.method;
        if (__hn_s0 === "GET") {
          return 응답(res, 200, await 불러오기())
        }
        else if (__hn_s0 === "POST") {
          const { 내용 } = await 본문읽기(req)
          if (typeof 내용 !== "string" || !내용.trim()) {
            return 응답(res, 400, { 에러: "빈 할 일" })
          }
          const 할일들 = await 불러오기()
          const 새할일 = { id: Date.now(), 내용: 내용.trim(), 완료: false }
          할일들.push(새할일)
          await 저장하기(할일들)
          return 응답(res, 201, 새할일)
        }
        else {
          return 응답(res, 405, { 에러: "지원하지 않는 메서드" })
        }
      }
    } else if (id !== null) {
      const 할일들 = await 불러오기()
      const 위치 = 할일들.findIndex(할일 => 할일.id === id)
      if (위치 === -1) {
        return 응답(res, 404, { 에러: "없는 할 일" })
      }
      { const __hn_s1 = req.method;
        if (__hn_s1 === "PATCH") {
          할일들[위치].완료 = !할일들[위치].완료
          await 저장하기(할일들)
          return 응답(res, 200, 할일들[위치])
        }
        else if (__hn_s1 === "DELETE") {
          할일들.splice(위치, 1)
          await 저장하기(할일들)
          res.writeHead(204).end()
          return
        }
        else {
          return 응답(res, 405, { 에러: "지원하지 않는 메서드" })
        }
      }
    }
    응답(res, 404, { 에러: "없는 경로" })
  } catch (에러) {
    console.log(에러)
    응답(res, 500, { 에러: "서버 오류" })
  }
})

서버.listen(포트, () => {
  console.log(`할 일 서버: http://localhost:${포트}`)
})
import { __hn } from "hannam-lang/runtime"
