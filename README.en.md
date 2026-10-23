<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark.svg" />
    <img src="./assets/logo-light.svg" alt="MzScript" height="72" />
  </picture>
  <p><strong>It's just JavaScript, in a different tone.</strong></p>
  <p>
    <a href="https://www.npmjs.com/package/mzscript"><img src="https://img.shields.io/npm/v/mzscript.svg?style=flat-square&colorA=000&colorB=000" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/mzscript"><img src="https://img.shields.io/npm/dm/mzscript.svg?style=flat-square&colorA=000&colorB=000" alt="npm downloads" /></a>
    <a href="https://github.com/keemtj/mzscript"><img src="https://img.shields.io/github/stars/keemtj/mzscript?style=flat-square&colorA=000&colorB=000" alt="GitHub stars" /></a>
    <a href="https://github.com/keemtj/mzscript/blob/main/LICENSE"><img src="https://img.shields.io/github/license/keemtj/mzscript?style=flat-square&colorA=000&colorB=000" alt="MIT License" /></a>
  </p>
  <p><a href="./README.md">한국어</a> | English</p>
</div>

## What is MzScript?

MzScript is not a new language. It is JavaScript written with Korean slang keywords. In a `.mz` file you write `예?` instead of `if` and `무슨 발언이세요?` instead of `console.log`, and the compiler turns it into JavaScript. Only keywords at the start of a statement change. Everything else, including the DOM, `fetch`, Node APIs, and npm packages, is plain JavaScript. The output is an ES module, so it runs in browsers, Node, and Bun.

The keywords are Korean, so the documentation is written in Korean.

## Example

```mz title="todo.mz"
티~원 불러오기() {
  아! 줴줴이야~ [
    { 내용: "우유 사기", 완료: true },
    { 내용: "README 쓰기", 완료: false },
  ]
}

요이~ 할일 티~원! 불러오기() {
  예? 할일.완료 {
    아뇨
  }
  무슨 발언이세요? `□ ${할일.내용}`
}
```

```js title="todo.js"
async function 불러오기() {
  return [
    { 내용: "우유 사기", 완료: true },
    { 내용: "README 쓰기", 완료: false },
  ]
}

for (const 할일 of await 불러오기()) {
  if (할일.완료) {
    continue
  }
  console.log(`□ ${할일.내용}`)
}
```

| MzScript | JavaScript |
| --- | --- |
| `엄` / `엄.` / `엄..` / `엄...` | `var` / `let` / `const` / `// comment` |
| `예?` / `예??` / `예???` | `if` / `else if` / `switch` |
| `아뇨아뇨아뇨아뇨` | `else`, `default` |
| `요이~` / `요이이이~` | `for...of` and ranges / `while` |
| `요히~` | `for...in` |
| `줴줴이야` / `아뇨` | `break` / `continue` |
| `아! 줴줴이야~` / `아... 줴줴이야...` | `return` / `throw` |
| `티-원` / `티~원` / `티~원!` | `function` / `async function` / `await` |
| `진~지?` / `지~랄` | `try` / `catch` |
| `오호호호호~` / `오호호호홋~` | `class` / `class extends` |
| `무슨 발언이세요? 값` / `예? 무슨 발언이세요?(질문)` | `console.log` / `confirm` |

## Quick start

Requires Node 20.16 or later.

```sh
npm i -D mzscript
```

```sh
npx mz todo.mz   # run directly
npx mzc todo.mz      # compile to todo.js
```

`mz` runs `.mz` files directly, and `mzc` (mzscript compiler) writes `.js` files. Installing with pnpm, yarn, or bun is covered in the [installation guide](apps/site/content/docs/getting-started/installation.mdx) (Korean).

## Packages

| Package | Purpose |
| --- | --- |
| [`mzscript`](packages/mzscript) | The `mz` runner, the `mzc` compiler, a Node loader hook, and a Bun plugin |
| [`@mzscript/vite-plugin`](packages/vite-plugin) | Import `.mz` modules in Vite |
| [`@mzscript/core`](packages/core) | The compiler API (`compile`) for building your own tools |
| [VS Code extension](packages/vscode) | Syntax highlighting, snippets, and compile error diagnostics. Install it from this repository as a `.vsix` |

## How it works

1. A lexer finds JavaScript token boundaries, telling strings, template literals, comments, and regular expressions apart.
2. The compiler tracks brackets and blocks to find where each statement starts, and replaces only the MzScript keywords found there.
3. It never re-prints a syntax tree. It edits the keyword positions in the original text, so line numbers and comments stay intact and source maps point back to the `.mz` file.
4. JavaScript without MzScript keywords comes out byte-for-byte identical. This is tested against 648 JavaScript files from pinned npm packages.

See [compiler architecture](apps/site/content/docs/compiler.mdx) (Korean) for details.

## Documentation

The documentation is written in Korean.

- [Introduction](apps/site/content/docs/index.mdx)
- [Syntax reference](apps/site/content/docs/syntax/index.mdx)
- [Building a full-stack todo app](apps/site/content/docs/guides/todo-fullstack.mdx): an example with both the server and the UI written in `.mz` ([`examples/todo`](examples/todo))
- [Migrating from JavaScript](apps/site/content/docs/guides/from-javascript.mdx)

## Development

```sh
pnpm install
pnpm build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) (Korean) for the development setup, commit rules, and the criteria for proposing new keywords.

## Release

Add a changeset for every package-facing change.

```sh
pnpm changeset
```

Merging to `main` creates or updates a version pull request. Merging that pull request publishes the npm packages. See [RELEASING.md](.github/RELEASING.md) (Korean) for the one-time repository setup.

## License

[MIT](LICENSE)
