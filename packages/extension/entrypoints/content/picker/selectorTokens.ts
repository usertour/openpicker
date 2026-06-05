/**
 * Tokenize a CSS selector for syntax highlighting in the selector field. Best-effort
 * and resilient: anything unrecognized falls through as "punctuation", so an
 * in-progress or invalid selector still renders without throwing. Invariant: the
 * concatenated token text always equals the input exactly (no chars dropped/added),
 * which keeps the highlight layer aligned with the editable textarea over it.
 */

export type SelectorTokenType =
  | "tag"
  | "id"
  | "class"
  | "attr"
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

    // Whitespace = the descendant combinator (also absorbs space around > + ~).
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
      // Functional pseudo-class: include a balanced (...) group.
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
      // Sub-tokenize the attribute selector: brackets/operators as punctuation,
      // the name and value as "attr".
      push("[", "punctuation")
      i++
      i = (() => {
        const nameEnd = runOfWord(i)
        push(selector.slice(i, nameEnd), "attr")
        let k = nameEnd
        while (k < n && selector.charAt(k) !== "]") {
          const ch = selector.charAt(k)
          if (ch === '"' || ch === "'") {
            let q = k + 1
            while (q < n && selector.charAt(q) !== ch) q++
            if (q < n) q++ // include the closing quote
            push(selector.slice(k, q), "attr")
            k = q
          } else if (/[\s~|^$*=]/.test(ch)) {
            push(ch, "punctuation")
            k++
          } else {
            let v = k
            while (v < n && !/[\]\s=~|^$*'"]/.test(selector.charAt(v))) v++
            push(selector.slice(k, v), "attr")
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

    // Commas, stray parens, and anything else.
    push(c, "punctuation")
    i++
  }

  return tokens
}
