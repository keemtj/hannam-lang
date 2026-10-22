import { Tab, Tabs } from "fumadocs-ui/components/tabs"
import { CopyCommand } from "./copy-command"

const MANAGERS = [
  { name: "npm", install: "npm i -D hannam-lang", run: "npx hannam app.hn" },
  { name: "pnpm", install: "pnpm add -D hannam-lang", run: "pnpm exec hannam app.hn" },
  { name: "yarn", install: "yarn add -D hannam-lang", run: "yarn hannam app.hn" },
  { name: "bun", install: "bun add -d hannam-lang", run: "bun --preload hannam-lang/bun app.hn" },
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
