export const appName = "한남랭"
export const docsRoute = "/docs"
export const githubUrl = "https://github.com/keemtj/hannam-lang"

// 사이트 주소. Vercel 빌드에서는 프로젝트의 운영 도메인을 쓰고, 로컬 빌드에서는 지금 운영 주소를 쓴다
export const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://hannam-lang.vercel.app"
export const siteDescription =
  "그냥 JavaScript입니다. 말투만 한남입니다. .hn으로 쓰고 JS로 바꿔 브라우저와 Node에서 실행합니다."
