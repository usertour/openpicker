import type { SelectorConfig } from "@openpicker/protocol"

/**
 * The resolved selector rules the editor works on: one anchor per dimension with
 * every field present. This mirrors the extension's persisted `SelectorSettings`
 * (structurally identical) so the extension can pass its settings straight in. The
 * SDK's {@link SelectorConfig} is the *sparse* form — convert with
 * {@link toSelectorConfig}.
 */

export interface SelectorAnchor {
  enabled: boolean
  /** Only names matching this regex may be used. "" = the dimension's stable-name default. */
  allow: string
  /** Names matching this regex are never used. "" = none. */
  ignore: string
}

export interface SelectorRules {
  id: SelectorAnchor
  class: SelectorAnchor
  attr: SelectorAnchor
  tag: SelectorAnchor
}

export type SelectorRulesDimension = keyof SelectorRules

export const SELECTOR_RULES_DIMENSIONS: SelectorRulesDimension[] = ["id", "class", "attr", "tag"]

export function defaultAnchor(): SelectorAnchor {
  return { enabled: true, allow: "", ignore: "" }
}

/** Fresh rules: every anchor on, nothing ignored, allow empty (smart defaults). */
export function emptySelectorRules(): SelectorRules {
  return {
    id: defaultAnchor(),
    class: defaultAnchor(),
    attr: defaultAnchor(),
    tag: defaultAnchor(),
  }
}

/**
 * Convert resolved rules into the sparse {@link SelectorConfig} that the SDK's
 * `pick({ selector })` accepts — only fields that differ from the default are kept,
 * and `undefined` is returned when nothing is set (so `pick` uses the user's rules).
 */
export function toSelectorConfig(rules: SelectorRules): SelectorConfig | undefined {
  const config: SelectorConfig = {}
  for (const dim of SELECTOR_RULES_DIMENSIONS) {
    const anchor = rules[dim]
    const out: { enabled?: boolean; allow?: string; ignore?: string } = {}
    if (!anchor.enabled) out.enabled = false
    if (anchor.allow.trim()) out.allow = anchor.allow.trim()
    if (anchor.ignore.trim()) out.ignore = anchor.ignore.trim()
    if (Object.keys(out).length > 0) config[dim] = out
  }
  return Object.keys(config).length > 0 ? config : undefined
}
