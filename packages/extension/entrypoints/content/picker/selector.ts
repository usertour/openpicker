import { attr as defaultAttr, finder } from "@medv/finder"
import type { SelectorAnchor, SelectorSettings } from "./selectorSettings"

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

/** Fallback when finder can't produce a unique selector: tag + stable classes. */
function fallbackSelector(el: Element, settings: SelectorSettings): string {
  const tag = el.tagName.toLowerCase()
  if (!settings.class.enabled) return tag
  const classOk = anchorPredicate(settings.class, isStableClass)
  const classes =
    typeof el.className === "string"
      ? el.className
          .trim()
          .split(/\s+/)
          .filter((c) => c && classOk(c))
      : []
  if (classes.length === 0) return tag
  return `${tag}.${classes.map((c) => CSS.escape(c)).join(".")}`
}

/** Generate a unique CSS selector for an element, honoring the anchor settings. */
export function generateSelector(el: Element, settings: SelectorSettings): string {
  try {
    return finder(el, {
      idName: settings.id.enabled ? anchorPredicate(settings.id, isStableId) : never,
      className: settings.class.enabled ? anchorPredicate(settings.class, isStableClass) : never,
      tagName: settings.tag.enabled ? anchorPredicate(settings.tag, () => true) : never,
      attr: settings.attr.enabled ? anchorPredicate(settings.attr, isDefaultAttr) : never,
    })
  } catch {
    // finder throws if it cannot find a unique selector; fall back to a tag path.
    return fallbackSelector(el, settings)
  }
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
