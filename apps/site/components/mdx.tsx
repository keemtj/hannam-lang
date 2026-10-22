import { Tab, Tabs } from "fumadocs-ui/components/tabs"
import { Step, Steps } from "fumadocs-ui/components/steps"
import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import { TryIt } from "./try-it"

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Tab,
    Tabs,
    Step,
    Steps,
    TryIt,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
