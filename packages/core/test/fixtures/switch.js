{ const __hn_s0 = 필터;
  if (__hn_s0 === "전체") {
    보여줄것 = 할일들
  }
  else if (__hn_s0 === "완료" || __hn_s0 === "보관") {
    보여줄것 = 할일들.filter(할일 => 할일.완료)
  }
  else {
    보여줄것 = 할일들.filter(할일 => !할일.완료)
  }
}

{ const __hn_s1 = 상태;
  // 갈래 사이 주석
  if (__hn_s1 === 1) { console.log("하나") }
  else if (__hn_s1 === 2) { console.log("둘") }
}

{ const __hn_s2 = 값;
  {
    console.log("기본만")
  }
}
