/** How the generated selector should match. See PROTOCOL.md §6.2 and DESIGN.md §5.1f. */
export type SelectorMode = "unique" | "list"

export interface PingParams {
  /** Display-only application name, surfaced in the consent prompt. Never trusted. */
  appName?: string
}

export interface PingResult {
  /** The extension's own version (from its manifest). */
  extensionVersion: string
  /** Protocol majors the extension supports. */
  protocolVersions: number[]
  /** Feature flags so the SDK can degrade gracefully. */
  capabilities: string[]
}

export interface PickParams {
  /** "unique" (default) selects one element; "list" selects a group of similar elements. */
  mode?: SelectorMode
  /** Extra regex of id/class names to exclude, layered on the built-in blacklist. */
  exclude?: string
  /** Request resolution of elements inside iframes (may be reported unsupported in v1). */
  iframe?: boolean
  /** Whether to include a cropped screenshot in the result. */
  screenshot?: boolean
  /** Display-only application name, surfaced in the consent prompt. Never trusted. */
  appName?: string
}

export interface PickedElement {
  tag: string
  id?: string
  classes?: string[]
  text?: string
  attributes?: Record<string, string>
}

export interface PickResult {
  /** The chosen CSS selector. */
  selector: string
  /** How many elements the selector currently matches. */
  matchCount: number
  /** A summary of the selected element. */
  element: PickedElement
  /** Attributes the user checked as extra match criteria (e.g. innerText). */
  criteria?: Record<string, string>
  /** Present only when `screenshot` was requested. */
  screenshot?: string
}

export type CancelParams = Record<string, never>
export type CancelResult = Record<string, never>

export interface HighlightParams {
  selector: string
}

export interface HighlightResult {
  matchCount: number
}

export type ClearHighlightParams = Record<string, never>
export type ClearHighlightResult = Record<string, never>

/** Maps each method name to its request params and response result. */
export interface MethodMap {
  ping: { params: PingParams; result: PingResult }
  pick: { params: PickParams; result: PickResult }
  cancel: { params: CancelParams; result: CancelResult }
  highlight: { params: HighlightParams; result: HighlightResult }
  clearHighlight: { params: ClearHighlightParams; result: ClearHighlightResult }
}

export type MethodName = keyof MethodMap
