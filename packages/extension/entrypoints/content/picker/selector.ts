import { attr as defaultAttr, finder } from "@medv/finder"

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
  /** Whether the selector may use the element's id. */
  useIds: boolean
  /** Whether the selector may use the element's classes. */
  useClasses: boolean
  /** Whether the selector may use the element's attributes. */
  useAttrs: boolean
  /** Regex (source string) of id names to ignore. */
  ignoreId?: string
  /** Regex (source string) of class names to ignore. */
  ignoreClass?: string
  /**
   * Comma/space/pipe-separated attribute names to allow as anchors. Empty → a
   * sensible default set (test hooks + finder's defaults: name/aria-label/role/…).
   */
  attrAllow?: string
}

function compileExclude(pattern: string | undefined): RegExp | null {
  if (!pattern) return null
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

/** Parse the attribute allow-list; null means "use the default set". */
function parseAttrAllow(raw: string | undefined): string[] | null {
  const list = (raw ?? "")
    .split(/[\s,|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return list.length ? list : null
}

/** Whether finder may use this attribute, per the allow-list (or the default set). */
function attrAllowed(name: string, value: string, allow: string[] | null): boolean {
  if (allow) return allow.includes(name.toLowerCase())
  // Default: prefer test hooks, plus finder's own curated set (name/aria-label/role/href/data-*).
  return PREFERRED_ATTR.test(name) || defaultAttr(name, value)
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

/** Fallback when finder can't produce a unique selector: tag + stable classes. */
function fallbackSelector(el: Element, useClasses: boolean, ignoreClassRe: RegExp | null): string {
  const tag = el.tagName.toLowerCase()
  if (!useClasses) return tag
  const classes =
    typeof el.className === "string"
      ? el.className.trim().split(/\s+/).filter((c) => c && isStableClass(c, ignoreClassRe))
      : []
  if (classes.length === 0) return tag
  return `${tag}.${classes.map((c) => CSS.escape(c)).join(".")}`
}

const never = () => false

/** Generate a unique CSS selector for an element, honoring the anchor settings. */
export function generateSelector(el: Element, config: SelectorConfig): string {
  const ignoreIdRe = compileExclude(config.ignoreId)
  const ignoreClassRe = compileExclude(config.ignoreClass)
  const allow = parseAttrAllow(config.attrAllow)
  try {
    return finder(el, {
      idName: config.useIds ? (name) => isStableId(name, ignoreIdRe) : never,
      className: config.useClasses ? (name) => isStableClass(name, ignoreClassRe) : never,
      attr: config.useAttrs ? (name, value) => attrAllowed(name, value, allow) : never,
    })
  } catch {
    // finder throws if it cannot find a unique selector; fall back to a tag path.
    return fallbackSelector(el, config.useClasses, ignoreClassRe)
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
