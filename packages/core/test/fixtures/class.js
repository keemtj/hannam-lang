class 할일 {
  constructor(내용) {
    this.내용 = 내용
    this.완료 = false
  }

  토글() {
    this.완료 = !this.완료
    if (this.완료) {
      console.log("완료!")
    }
    return this
  }
}

class 마감할일 extends 할일 {
  constructor(내용, 마감일) {
    super(내용)
    this.마감일 = 마감일
  }
}

export class 내보낼할일 {}
