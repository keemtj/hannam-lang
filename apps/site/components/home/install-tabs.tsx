import { Tab, Tabs } from "fumadocs-ui/components/tabs"
import { CopyCommand } from "./copy-command"

const MANAGERS = [
  { name: "npm", install: "npm i -D mzscript", run: "npx mz app.mz" },
  { name: "pnpm", install: "pnpm add -D mzscript", run: "pnpm exec mz app.mz" },
  { name: "yarn", install: "yarn add -D mzscript", run: "yarn mz app.mz" },
  { name: "bun", install: "bun add -d mzscript", run: "bun --preload mzscript/bun app.mz" },
]

export function InstallTabs() {
  return (
    <Tabs items={MANAGERS.map((m) => m.name)} className="hn-install-tabs">
      {MANAGERS.map((m) => (
        <Tab key={m.name} value={m.name}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fd-muted-foreground">프로젝트에 설치</p>
            <CopyCommand command={m.install} />
            <p className="text-sm text-fd-muted-foreground">실행</p>
            <CopyCommand command={m.run} />
          </div>
        </Tab>
      ))}
    </Tabs>
  )
}
