import { attr as defaultAttr, finder } from "@medv/finder"
import { matchesSelectorConfig } from "@openpicker/protocol"
import { type SelectorAnchor, type SelectorSettings, toSelectorConfig } from "./selectorSettings"

/**
 * Selector generation, built on @medv/finder plus per-dimension rules
 * (id / class / attr / tag, each enable + allow/ignore regex) and built-in filters
 * that reject auto-generated ids and hashed CSS-in-JS / CSS-module class names so
 * the output favors stable, human-readable selectors. See DESIGN.md §5.2 / §5.1f.
 */

// Prefixes / shapes of auto-generated ids that should not anchor a selector.
const HASHED_ID_PATTERNS: RegExp[] = [
  /^ember\d+$/,
  /^radix-[-:]/i,
  /^react-aria-?\d/i,
  /^headlessui-/i,
  /^:r[0-9a-z]+:?$/i, // React useId
  /^[0-9a-f]{8,}$/i, // long hex hash
]

// Shapes of hashed class names (CSS modules, CSS-in-JS, etc.).
const HASHED_CLASS_PATTERNS: RegExp[] = [
  /^css-[a-z0-9]+$/i, // emotion
  /^sc-[a-zA-Z0-9]+$/, // styled-components
  /^emotion-/i,
  /^[a-z0-9]*(?=[a-z])(?=[0-9])[a-z0-9]{6,}$/i, // single random-looking token
]

// Attributes worth preferring as selector anchors (test hooks).
const PREFERRED_ATTR = /^data-(testid|test|test-id|cy|qa)$/i

/**
 * The default attribute names used when an attribute allow-list is empty ("auto"),
 * shown in the settings UI. Mirrors PREFERRED_ATTR + finder's accepted set.
 */
export const AUTO_ATTRS = [
  "name",
  "aria-label",
  "role",
  "rel",
  "href",
  "data-testid",
  "data-cy",
  "data-*",
]

function compile(pattern: string): RegExp | null {
  if (!pattern) return null
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

function matchesAny(name: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(name))
}

/** Whether an id looks human-authored (not an auto-generated/hashed id). */
export function isStableId(name: string): boolean {
  return !!name && !matchesAny(name, HASHED_ID_PATTERNS)
}

/** Whether a class looks human-authored (not a hashed CSS-in-JS / module name). */
export function isStableClass(name: string): boolean {
  return !!name && !matchesAny(name, HASHED_CLASS_PATTERNS)
}

/** Default attribute predicate: prefer test hooks, plus finder's own curated set. */
function isDefaultAttr(name: string, value: string): boolean {
  return PREFERRED_ATTR.test(name) || defaultAttr(name, value)
}

/**
 * Build a finder predicate for one anchor: `ignore` wins, then `allow`, else the
 * dimension's built-in stable-name default. Returns a `(name, value?)` so it fits
 * both the name-only predicates (id/class/tag) and finder's `attr(name, value)`.
 */
function anchorPredicate(
  anchor: SelectorAnchor,
  smartDefault: (name: string, value: string) => boolean,
): (name: string, value?: string) => boolean {
  const allowRe = compile(anchor.allow)
  const ignoreRe = compile(anchor.ignore)
  return (name, value = "") => {
    if (!name) return false
    if (ignoreRe?.test(name)) return false
    if (allowRe) return allowRe.test(name)
    return smartDefault(name, value)
  }
}

const never = () => false

/**
 * Last-resort selector when finder fails — but only from anchors the rules allow:
 * the tag (if enabled and permitted) and stable, permitted classes. Returns "" when
 * neither is available, so we never fabricate a selector that breaks the rules.
 */
function fallbackSelector(el: Element, settings: SelectorSettings): string {
  const tagName = el.tagName.toLowerCase()
  const tag =
    settings.tag.enabled && anchorPredicate(settings.tag, () => true)(tagName) ? tagName : ""
  let classes: string[] = []
  if (settings.class.enabled) {
    const classOk = anchorPredicate(settings.class, isStableClass)
    classes =
      typeof el.className === "string"
        ? el.className
            .trim()
            .split(/\s+/)
            .filter((c) => c && classOk(c))
        : []
  }
  if (!tag && classes.length === 0) return ""
  return `${tag}${classes.map((c) => `.${CSS.escape(c)}`).join("")}`
}

/**
 * finder's structural fallback embeds the tag in `tag:nth-child(n)` even when the tag
 * anchor is disabled (it isn't gated by the predicate). Drop that tag prefix so the
 * selector can conform; the caller re-verifies uniqueness before using the result.
 */
function stripNthChildTags(selector: string): string {
  return selector.replace(/(^|[\s>+~(])[a-zA-Z][\w-]*(?=:nth-child\()/g, "$1")
}

/** Whether `selector` uniquely identifies `el` in the document. */
function uniquelyMatches(selector: string, el: Element): boolean {
  try {
    const list = document.querySelectorAll(selector)
    return list.length === 1 && list[0] === el
  } catch {
    return false
  }
}

/** Whether any explicit selector rules are configured (vs all-default). */
export function hasSelectorRules(settings: SelectorSettings): boolean {
  return toSelectorConfig(settings) !== undefined
}

/** Whether a selector only uses anchors the rules permit (true when there are no rules). */
export function conformsToSettings(selector: string, settings: SelectorSettings): boolean {
  const config = toSelectorConfig(settings)
  return !config || matchesSelectorConfig(selector, config)
}

/**
 * Generate a CSS selector for an element under the anchor settings. With rules active
 * the contract is "a selector that conforms to the rules, or empty" — never a selector
 * that quietly breaks them (finder is best-effort and can leak tag tokens). Recovers a
 * conforming selector by stripping finder's `tag:nth-child` tags where possible.
 */
export function generateSelector(el: Element, settings: SelectorSettings): string {
  let s = ""
  try {
    s = finder(el, {
      idName: settings.id.enabled ? anchorPredicate(settings.id, isStableId) : never,
      className: settings.class.enabled ? anchorPredicate(settings.class, isStableClass) : never,
      tagName: settings.tag.enabled ? anchorPredicate(settings.tag, () => true) : never,
      attr: settings.attr.enabled ? anchorPredicate(settings.attr, isDefaultAttr) : never,
    })
  } catch {
    s = ""
  }

  const config = toSelectorConfig(settings)
  // No explicit rules: keep finder's selector, or a best-effort tag/class fallback.
  if (!config) return s || fallbackSelector(el, settings)

  // Rules active: return only a conforming selector, else "".
  if (s && matchesSelectorConfig(s, config)) return s
  if (s) {
    const stripped = stripNthChildTags(s)
    if (
      stripped !== s &&
      uniquelyMatches(stripped, el) &&
      matchesSelectorConfig(stripped, config)
    ) {
      return stripped
    }
  }
  const fb = fallbackSelector(el, settings)
  return fb && matchesSelectorConfig(fb, config) ? fb : ""
}

/** How many elements the selector currently matches in the document. */
export function matchCount(selector: string): number {
  if (!selector.trim()) return 0
  try {
    return document.querySelectorAll(selector).length
  } catch {
    return 0
  }
}

/**
 * Evaluate a selector: its match count, and whether it is even valid CSS.
 * `querySelectorAll` throws a SyntaxError on an invalid selector, which lets us
 * distinguish "0 matches" from "you mistyped the selector".
 */
export function evalSelector(selector: string): { valid: boolean; count: number } {
  if (!selector.trim()) return { valid: true, count: 0 }
  try {
    return { valid: true, count: document.querySelectorAll(selector).length }
  } catch {
    return { valid: false, count: 0 }
  }
}
