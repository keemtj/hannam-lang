if (개수 === 0) {
  console.log("할 일 없음")
} else if (개수 < 5) {
  console.log("여유 있음")
} else {
  console.log("바쁨")
}

if (개수 > 10) {
  console.log("괄호 조건")
}

if (목록.some(x => {
  return x > 1
})) {
  console.log("조건 안의 블록")
}

if (!내용
  && 개수) {
  console.log("여러 줄 조건")
}
