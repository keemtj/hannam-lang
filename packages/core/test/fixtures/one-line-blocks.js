function 보이는할일() {
  { const __mz_s0 = 필터;
    if (__mz_s0 === "전체") { return 할일들 }
    else if (__mz_s0 === "완료") { return 할일들.filter(할일 => 할일.완료) }
  }
  if (!항목) { return }
}
