/**
 * What the returned screenshot covers. See DESIGN.md §5b.
 * - "none": no screenshot.
 * - "element": cropped to the selected element.
 * - "viewport": the full visible viewport.
 * ("fullpage" is reserved for the future.)
 */
export type ScreenshotMode = "none" | "element" | "viewport"

/** A regular-expression source string. Compiled with `new RegExp(...)` — never eval'd. */
export type RegexSource = string

/**
 * Rules for one anchor type (id / class / attr / tag) when building a selector.
 * This mirrors the in-picker gear settings; passed via {@link PickParams.selector}
 * it pre-fills them. For `attr`, `allow`/`ignore` match the attribute NAME.
 */
export interface SelectorAnchorConfig {
  /** Whether this anchor type may be used at all. Default: true. */
  enabled?: boolean
  /**
   * Only names matching this regex may be used. Omitted/empty = openpicker's
   * built-in "stable name" heuristics (skips ember/radix ids, hashed CSS-in-JS /
   * CSS-module classes, etc.).
   */
  allow?: RegexSource
  /** Names matching this regex are never used (applied on top of `allow`). */
  ignore?: RegexSource
}

/** Per-dimension selector-generation rules. See {@link SelectorAnchorConfig}. */
export interface SelectorConfig {
  id?: SelectorAnchorConfig
  class?: SelectorAnchorConfig
  attr?: SelectorAnchorConfig
  tag?: SelectorAnchorConfig
}

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
  /** Request resolution of elements inside iframes (may be reported unsupported in v1). */
  iframe?: boolean
  /**
   * Screenshot to include in the result. A {@link ScreenshotMode}, or a boolean for
   * compatibility (`true` → "element", `false` → "none"). Defaults to "none".
   */
  screenshot?: ScreenshotMode | boolean
  /**
   * The URL to pick in. The extension opens it in a tab, the user picks there, and
   * the result is routed back to the calling tab (cross-tab picking). Required: an
   * extension earns its keep by crossing the tab/origin boundary — a page can
   * already script its own DOM, so same-tab picking is not an SDK capability (only
   * the toolbar offers it, for humans). Requires the "openUrl" capability.
   */
  url: string
  /**
   * Optional opaque identifier for "which task" this pick is for. Only used to
   * decide whether a follow-up cross-tab pick reuses the existing target tab or
   * opens a new one (equality compare; never interpreted). See DESIGN.md §5d.
   */
  key?: string
  /** Display-only application name, surfaced in the consent prompt. Never trusted. */
  appName?: string
  /**
   * Initial selector-generation rules for this pick (also the values shown in the
   * gear). Composed (AND) with the user's saved rules — both can only narrow.
   * Omitted dimensions use openpicker's defaults.
   */
  selector?: SelectorConfig
  /** Open the gear settings read-only (the user can see them but not change). Default: false. */
  lockSelectorSettings?: boolean
  /** Make the selector field read-only (no hand-editing). Default: false. */
  lockSelectorEdit?: boolean
  /** Only allow confirming (OK) when the selector matches exactly one element. Default: false. */
  requireUniqueMatch?: boolean
  /**
   * Restrict which elements can be picked: the user may only select an element that
   * matches this CSS selector — hovering a descendant snaps to the nearest matching
   * ancestor (Element.closest), and elements with no match are not selectable
   * (not-allowed cursor, click ignored). A comma list works:
   * "input, textarea, select, [contenteditable]". Omit for no restriction.
   *
   * Orthogonal to {@link selector}: `mustMatch` decides WHICH element is picked,
   * `selector` decides HOW its selector is built. Must be a valid CSS selector — an
   * invalid one rejects the pick with `invalid_params`.
   */
  mustMatch?: string
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

export type ActivateSelfParams = Record<string, never>
export type ActivateSelfResult = Record<string, never>

export type IsTargetOpenParams = Record<string, never>
export interface IsTargetOpenResult {
  /** Whether a cross-tab target tab opened by this source is still open. */
  open: boolean
}

/** Maps each method name to its request params and response result. */
export interface MethodMap {
  ping: { params: PingParams; result: PingResult }
  pick: { params: PickParams; result: PickResult }
  cancel: { params: CancelParams; result: CancelResult }
  highlight: { params: HighlightParams; result: HighlightResult }
  clearHighlight: { params: ClearHighlightParams; result: ClearHighlightResult }
  /** Bring the calling tab to the foreground (it can only focus itself). */
  activateSelf: { params: ActivateSelfParams; result: ActivateSelfResult }
  /** Report whether the cross-tab target opened by this source is still open. */
  isTargetOpen: { params: IsTargetOpenParams; result: IsTargetOpenResult }
}

export type MethodName = keyof MethodMap
