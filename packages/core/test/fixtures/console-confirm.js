console.log("할 일 추가됨")
console.log(`할 일 ${할일들.length}개`)
console.log("현재 필터:", 필터)
console.log((a + b) * 2)
console.log()
console.log(값) // 줄 주석

const 지울까 = __mz.confirm("완료한 할 일을 지울까요?")

if (__mz.confirm("전부 지울까요?")) {
  할일들.length = 0
}
import { __mz } from "mzscript/runtime"
