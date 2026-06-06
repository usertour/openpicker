import {
  emptySelectorRules,
  type SelectorRules,
  SelectorRulesFields,
  toSelectorConfig,
} from "@openpicker/selector-rules-ui"
import { useState } from "react"
import { createRoot } from "react-dom/client"

/**
 * A small React island for the shared selector-rules editor, mounted into the
 * otherwise-vanilla demo. The current rules are mirrored to a module variable so the
 * imperative pick() flow can read them via {@link getSelectorConfig}.
 */

let current: SelectorRules = emptySelectorRules()

/** The rules currently entered, as the sparse config the SDK's pick() takes (or undefined). */
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
