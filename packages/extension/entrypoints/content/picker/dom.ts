import type { PickedElement } from "@openpicker/protocol"

/** Geometry, labelling, attribute extraction, and DOM-tree navigation helpers. */

/**
 * The element a pick would actually select for `el` under a `mustMatch` constraint:
 * the nearest ancestor (including `el` itself) that matches the CSS selector, or `el`
 * unchanged when there is no constraint. Returns null when nothing in the chain
 * matches — i.e. this position is not selectable. Defensive against a bad selector.
 */
export function resolveTarget(el: Element, mustMatch: string | undefined): Element | null {
  if (!mustMatch) return el
  try {
    return el.closest(mustMatch)
  } catch {
    return null
  }
}

/** Whether `el` itself matches the `mustMatch` constraint (true when unconstrained). */
export function matchesTarget(el: Element, mustMatch: string | undefined): boolean {
  if (!mustMatch) return true
  try {
    return el.matches(mustMatch)
  } catch {
    return false
  }
}

/** Whether a string is a syntactically valid CSS selector (parses without throwing). */
export function isValidSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector)
    return true
  } catch {
    return false
  }
}

/** A short human label for an element, e.g. `div#main.card`. */
export function tagLabel(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ""
  const cls =
    typeof el.className === "string" && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : ""
  return `${tag}${id}${cls}`
}

/** The element's opening tag rendered as text, for the on-page tooltip. */
export function openingTag(el: Element): string {
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}="${a.value}"`)
    .join(" ")
  return `<${el.tagName.toLowerCase()}${attrs ? ` ${attrs}` : ""}>`
}

/** The opening tag split into parts, for a syntax-highlighted multi-line preview. */
export function openingTagParts(el: Element): { tag: string; attrs: AttrEntry[] } {
  return {
    tag: el.tagName.toLowerCase(),
    attrs: Array.from(el.attributes).map((a) => ({ name: a.name, value: a.value })),
  }
}

/** Collapsed text content for the element preview ("" → caller shows "No Content"). */
export function contentSummary(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim()
}

export interface AttrEntry {
  name: string
  value: string
}

/**
 * Collect inspectable properties: synthetic text/markup props first, then the
 * element's real attributes. Used by the sidebar Attributes list.
 */
export function collectAttributes(el: Element): AttrEntry[] {
  const out: AttrEntry[] = []
  const html = el as HTMLElement
  if (typeof html.innerText === "string") out.push({ name: "innerText", value: html.innerText })
  out.push({ name: "textContent", value: el.textContent ?? "" })
  out.push({ name: "innerHTML", value: el.innerHTML })
  out.push({ name: "outerHTML", value: el.outerHTML })
  for (const attr of Array.from(el.attributes)) {
    out.push({ name: attr.name, value: attr.value })
  }
  return out
}

/** Summarize an element for the protocol PickResult. */
export function describeElement(el: Element): PickedElement {
  const classes =
    typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean) : []
  const attributes: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) attributes[attr.name] = attr.value
  const text = (el as HTMLElement).innerText?.trim().slice(0, 200)
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    classes: classes.length ? classes : undefined,
    text: text || undefined,
    attributes,
  }
}

// --- DOM tree navigation (skipping our own shadow host) -------------------

export function getParent(el: Element): Element | null {
  return el.parentElement
}

export function getFirstChild(el: Element, host: Element): Element | null {
  for (const child of Array.from(el.children)) {
    if (child !== host && !child.contains(host)) return child
  }
  return null
}

export function getPrevSibling(el: Element, host: Element): Element | null {
  let sib = el.previousElementSibling
  while (sib && sib === host) sib = sib.previousElementSibling
  return sib
}

export function getNextSibling(el: Element, host: Element): Element | null {
  let sib = el.nextElementSibling
  while (sib && sib === host) sib = sib.nextElementSibling
  return sib
}
