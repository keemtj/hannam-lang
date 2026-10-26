# @hannam-lang/core

## 0.1.1

### Patch Changes

- [#7](https://github.com/keemtj/hannam-lang/pull/7) [`2c811e4`](https://github.com/keemtj/hannam-lang/commit/2c811e47c26a664a29ddaab5432c18146df4b394) Thanks [@keemtj](https://github.com/keemtj)! - 이미 있는 JavaScript를 한남랭으로 옮기는 역변환을 추가했습니다. `hnc --from-js <파일|디렉터리>`는 바뀔 내용을 보여 주고, `--write`를 주면 원본 옆에 `.hn` 파일을 만듭니다. 바꾼 코드는 다시 컴파일해서 원래 JS와 구문 트리가 같은지 확인하고, 의미가 달라질 수 있는 곳은 JS 그대로 둡니다. 코드에서는 `hannam-lang/migrate`(또는 `@hannam-lang/core/migrate`)의 `migrate()`로 부를 수 있습니다.
  
  Added a JavaScript-to-hannam-lang migration. `hnc --from-js <files|dirs>` shows what would change, and `--write` creates a `.hn` file next to each original. Every converted file is compiled back and compared with the original syntax tree, and anything whose meaning could change is left as plain JavaScript. The same API is available as `migrate()` from `hannam-lang/migrate` (or `@hannam-lang/core/migrate`).

## 0.1.0

### Minor Changes

- [`c446c13`](https://github.com/keemtj/hannam-lang/commit/c446c137065b91e2727288f6db00be5fd10a8273) Thanks [@keemtj](https://github.com/keemtj)! - 첫 공개 버전 (0.1.0): 키워드 11개 변환기, `hannam`/`hnc` CLI, Node 로더 훅과 Bun 플러그인, Vite 플러그인
  
  First public release (0.1.0): the 11-keyword compiler, the `hannam`/`hnc` CLI, a Node loader hook, a Bun plugin, and a Vite plugin
