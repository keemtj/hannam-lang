try {
  const 할일들 = await 불러오기("/api/todos")
} catch (e) {
  console.log(e.message)
}

try {
  위험한일()
} catch (에러) {
  console.log(에러)
} finally {
  로딩중 = false
}

try {
  위험한일()
} catch {
  console.log("무시")
}
