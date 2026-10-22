// `node --import hannam-lang/register app.hn`: .hn 로더 훅을 등록하고 소스맵을 켠다
import { register } from "node:module"

process.setSourceMapsEnabled(true)
register("./hooks.js", import.meta.url)
