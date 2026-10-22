for (const 할일 of 할일들) {
  if (할일.완료) {
    continue
  }
  console.log(할일.내용)
}

for (let i = 0; i < 할일들.length; i++) {
  console.log(`${i + 1}. ${할일들[i].내용}`)
}

for (let i = 1.5; i < 3; i++) {
  break
}

for (const 키 in 설정) {
  console.log(`${키}: ${설정[키]}`)
}

for (const [키, 값] of Object.entries(설정)) {
  console.log(`${키}=${값}`)
}

for (const { 내용 } of 할일들) {
  console.log(내용)
}

for (const x of [...앞, ...뒤]) {
  console.log(x)
}

let 남은수 = 3
while (남은수 > 0) {
  남은수--
}
