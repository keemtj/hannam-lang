{ const __mz_s0 = 필터;
  if (__mz_s0 === "전체") {
    보여줄것 = 할일들
  }
  else if (__mz_s0 === "완료" || __mz_s0 === "보관") {
    보여줄것 = 할일들.filter(할일 => 할일.완료)
  }
  else {
    보여줄것 = 할일들.filter(할일 => !할일.완료)
  }
}

{ const __mz_s1 = 상태;
  // 갈래 사이 주석
  if (__mz_s1 === 1) { console.log("하나") }
  else if (__mz_s1 === 2) { console.log("둘") }
}

{ const __mz_s2 = 값;
  {
    console.log("기본만")
  }
}
