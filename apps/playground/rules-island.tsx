import {
  emptySelectorRules,
  type SelectorRules,
  SelectorRulesFields,
  toSelectorConfig,
} from "@openpicker/selector-rules-ui"
import { useState } from "react"
import { createRoot } from "react-dom/client"

/** React island for the shared selector-rules editor; current rules mirrored for pick(). */

let current: SelectorRules = emptySelectorRules()

export function getSelectorConfig() {
  return toSelectorConfig(current)
}

function RulesIsland() {
  const [rules, setRules] = useState<SelectorRules>(emptySelectorRules())
  return (
    <SelectorRulesFields
      value={rules}
      onChange={(patch) =>
        setRules((prev) => {
          const next = { ...prev, ...patch }
          current = next
          return next
        })
      }
    />
  )
}

export function mountRulesIsland(el: HTMLElement): void {
  createRoot(el).render(<RulesIsland />)
}
