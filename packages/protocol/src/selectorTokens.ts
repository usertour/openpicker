import type { SelectorAnchorConfig, SelectorConfig } from "./methods"

/**
 * Tokenize a CSS selector for syntax highlighting and for validating a selector
 * against a {@link SelectorConfig}. Best-effort and resilient: anything
 * unrecognized falls through as "punctuation", so an in-progress or invalid
 * selector still tokenizes without throwing. Invariant: the concatenated token text
 * always equals the input exactly. Lives in the protocol package so both the
 * extension (highlighting) and the SDK (validation) can share it.
 */

export type SelectorTokenType =
  | "tag"
  | "id"
  | "class"
  | "attrName"
  | "attrValue"
  | "pseudo"
  | "combinator"
  | "punctuation"

export interface SelectorToken {
  text: string
  type: SelectorTokenType
}

const WORD = /[\w-]/

export function tokenizeSelector(selector: string): SelectorToken[] {
  const tokens: SelectorToken[] = []
  const n = selector.length
  let i = 0

  const push = (text: string, type: SelectorTokenType): void => {
    if (text) tokens.push({ text, type })
  }
  const runOfWord = (from: number): number => {
    let j = from
    while (j < n && WORD.test(selector.charAt(j))) j++
    return j
  }

  while (i < n) {
    const c = selector.charAt(i)

    if (/\s/.test(c)) {
      let j = i + 1
      while (j < n && /\s/.test(selector.charAt(j))) j++
      push(selector.slice(i, j), "combinator")
      i = j
      continue
    }
    if (c === ">" || c === "+" || c === "~") {
      push(c, "combinator")
      i++
      continue
    }
    if (c === "#") {
      const j = runOfWord(i + 1)
      push(selector.slice(i, j), "id")
      i = j
      continue
    }
    if (c === ".") {
      const j = runOfWord(i + 1)
      push(selector.slice(i, j), "class")
      i = j
      continue
    }
    if (c === ":") {
      let j = i + 1
      if (selector.charAt(j) === ":") j++
      j = runOfWord(j)
      if (selector.charAt(j) === "(") {
        let depth = 0
        while (j < n) {
          const ch = selector.charAt(j)
          j++
          if (ch === "(") depth++
          else if (ch === ")") {
            depth--
            if (depth === 0) break
          }
        }
      }
      push(selector.slice(i, j), "pseudo")
      i = j
      continue
    }
    if (c === "[") {
      push("[", "punctuation")
      i++
      i = (() => {
        const nameEnd = runOfWord(i)
        push(selector.slice(i, nameEnd), "attrName")
        let k = nameEnd
        while (k < n && selector.charAt(k) !== "]") {
          const ch = selector.charAt(k)
          if (ch === '"' || ch === "'") {
            let q = k + 1
            while (q < n && selector.charAt(q) !== ch) q++
            if (q < n) q++ // include the closing quote
            push(selector.slice(k, q), "attrValue")
            k = q
          } else if (/[\s~|^$*=]/.test(ch)) {
            push(ch, "punctuation")
            k++
          } else {
            let v = k
            while (v < n && !/[\]\s=~|^$*'"]/.test(selector.charAt(v))) v++
            push(selector.slice(k, v), "attrValue")
            k = v
          }
        }
        return k
      })()
      if (i < n && selector.charAt(i) === "]") {
        push("]", "punctuation")
        i++
      }
      continue
    }
    if (c === "*") {
      push("*", "tag")
      i++
      continue
    }
    if (WORD.test(c)) {
      const j = runOfWord(i)
      push(selector.slice(i, j), "tag")
      i = j
      continue
    }

    push(c, "punctuation")
    i++
  }

  return tokens
}

/** Whether a name is allowed by one anchor config. A missing anchor = no constraint. */
function anchorAllowsName(name: string, anchor?: SelectorAnchorConfig): boolean {
  if (!anchor) return true
  if (anchor.enabled === false) return false
  try {
    if (anchor.ignore && new RegExp(anchor.ignore).test(name)) return false
    if (anchor.allow) return new RegExp(anchor.allow).test(name)
  } catch {
    // A malformed regex constrains nothing — don't falsely reject.
    return true
  }
  return true
}

/**
 * Whether a CSS selector only uses anchors permitted by a {@link SelectorConfig} —
 * the SDK-side check a developer runs on the returned selector (which the user may
 * have hand-edited). Combinators, pseudo-classes, attribute values, and the
 * universal `*` are unconstrained. A selector touching no constrained anchors passes.
 */
export function matchesSelectorConfig(selector: string, config: SelectorConfig): boolean {
  for (const tok of tokenizeSelector(selector)) {
    if (tok.type === "id") {
      if (!anchorAllowsName(tok.text.replace(/^#/, ""), config.id)) return false
    } else if (tok.type === "class") {
      if (!anchorAllowsName(tok.text.replace(/^\./, ""), config.class)) return false
    } else if (tok.type === "tag") {
      if (tok.text !== "*" && !anchorAllowsName(tok.text, config.tag)) return false
    } else if (tok.type === "attrName") {
      if (!anchorAllowsName(tok.text, config.attr)) return false
    }
  }
  return true
}
