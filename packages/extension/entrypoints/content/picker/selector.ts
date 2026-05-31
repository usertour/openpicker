import { finder } from "@medv/finder"
import type { SelectorMode } from "@openpicker/protocol"

/**
 * Selector generation, built on @medv/finder (a dependency) plus filters that
 * reject auto-generated ids and hashed CSS-in-JS / CSS-module class names so the
 * output favors stable, human-readable selectors. See DESIGN.md §5.2 / §5.1f.
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

export interface SelectorConfig {
  mode: SelectorMode
  /** Extra regex (source string) of id/class names to exclude. */
  exclude?: string
}

function compileExclude(exclude: string | undefined): RegExp | null {
  if (!exclude) return null
  try {
    return new RegExp(exclude)
  } catch {
    return null
  }
}

function matchesAny(name: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(name))
}

export function isStableId(name: string, excludeRe: RegExp | null): boolean {
  if (!name) return false
  if (excludeRe?.test(name)) return false
  return !matchesAny(name, HASHED_ID_PATTERNS)
}

export function isStableClass(name: string, excludeRe: RegExp | null): boolean {
  if (!name) return false
  if (excludeRe?.test(name)) return false
  return !matchesAny(name, HASHED_CLASS_PATTERNS)
}

/** Build a selector that intentionally matches a group of similar elements. */
function listSelector(el: Element, excludeRe: RegExp | null): string {
  const tag = el.tagName.toLowerCase()
  const classes =
    typeof el.className === "string"
      ? el.className.trim().split(/\s+/).filter((c) => c && isStableClass(c, excludeRe))
      : []
  if (classes.length === 0) return tag
  return `${tag}.${classes.map((c) => CSS.escape(c)).join(".")}`
}

/** Generate a CSS selector for an element according to the given config. */
export function generateSelector(el: Element, config: SelectorConfig): string {
  const excludeRe = compileExclude(config.exclude)
  if (config.mode === "list") return listSelector(el, excludeRe)
  try {
    return finder(el, {
      idName: (name) => isStableId(name, excludeRe),
      className: (name) => isStableClass(name, excludeRe),
      attr: (name) => PREFERRED_ATTR.test(name),
    })
  } catch {
    // finder throws if it cannot find a unique selector; fall back to a tag path.
    return listSelector(el, excludeRe)
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
