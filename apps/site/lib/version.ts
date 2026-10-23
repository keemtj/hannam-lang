// 사이트에 보여 줄 최근 배포 버전. Version Packages PR을 병합하면 package.json의 버전이 바뀌고,
// 사이트는 main에서 다시 빌드되므로 따로 고칠 일이 없다. 세 패키지는 같은 버전으로 함께 나온다
import pkg from "../../../packages/mzscript/package.json"

export const version: string = pkg.version
