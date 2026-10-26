// "JS 가져오기": 붙여 넣은 JS를 한남랭으로 바꾼다. 파서(acorn)가 커서 처음 누를 때 불러온다
export type ImportOutcome =
  | { ok: true; code: string; changes: number; skipped: number }
  | { ok: false; message: string }

export async function importJs(js: string): Promise<ImportOutcome> {
  const { migrate, MigrateError } = await import("@hannam-lang/core/migrate")
  try {
    const result = migrate(js, { filename: "붙여 넣은 코드", comments: true })
    return { ok: true, code: result.code, changes: result.changes, skipped: result.skipped.length }
  } catch (e) {
    if (e instanceof MigrateError) return { ok: false, message: e.message }
    throw e
  }
}

/** 바꾼 뒤 편집기 위에 보여 줄 안내 문구 */
export function importNotice(outcome: Extract<ImportOutcome, { ok: true }>): string {
  if (outcome.changes === 0) return "한남랭 키워드로 바꿀 수 있는 곳이 없어서 JS 그대로 넣었습니다."
  const kept = outcome.skipped > 0 ? ` ${outcome.skipped}곳은 바꾸지 않고 JS 그대로 두었습니다.` : ""
  return `JS ${outcome.changes}곳을 한남랭으로 바꿨습니다.${kept}`
}
