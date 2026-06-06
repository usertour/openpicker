import type { SelectorAnchorConfig, SelectorConfig } from "@openpicker/protocol"

/**
 * The resolved selector settings: one anchor config per dimension, every field
 * present (unlike the sparse {@link SelectorConfig} the SDK passes). This is what
 * the gear edits, what's persisted per origin, and what drives finder. Composing a
 * sparse `SelectorConfig` over these (SDK pick, global default → per-site) yields a
 * resolved object again. See DESIGN.md §5.1f.
 */

/** Rules for one anchor type. `allow`/`ignore` are regex sources ("" = unset). */
export interface SelectorAnchor {
  enabled: boolean
  /** Only names matching this regex may be used. "" = the dimension's stable-name default. */
  allow: string
  /** Names matching this regex are never used. "" = none. */
  ignore: string
}

export interface SelectorSettings {
  id: SelectorAnchor
  class: SelectorAnchor
  attr: SelectorAnchor
  tag: SelectorAnchor
}

export type SelectorDimension = keyof SelectorSettings

export const SELECTOR_DIMENSIONS: SelectorDimension[] = ["id", "class", "attr", "tag"]

export function defaultAnchor(): SelectorAnchor {
  return { enabled: true, allow: "", ignore: "" }
}

/** Fresh settings: every anchor on, nothing ignored, attributes auto. */
export function defaultSelectorSettings(): SelectorSettings {
  return {
    id: defaultAnchor(),
    class: defaultAnchor(),
    attr: defaultAnchor(),
    tag: defaultAnchor(),
  }
}

/** Escape a literal string for use inside a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Convert a legacy comma/space/pipe attribute allow-list ("data-testid, name") into
 * an anchored alternation regex. Empty list → "" (use the default attribute set).
 */
export function attrListToRegex(list: string): string {
  const names = list
    .split(/[\s,|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (names.length === 0) return ""
  return `^(?:${names.map(escapeRegex).join("|")})$`
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function isAnchor(value: unknown): value is SelectorAnchor {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as SelectorAnchor).enabled === "boolean" &&
    typeof (value as SelectorAnchor).allow === "string" &&
    typeof (value as SelectorAnchor).ignore === "string"
  )
}

/**
 * Coerce a stored value into resolved settings: pass through the current shape,
 * migrate the legacy `{ useIds, ignoreId, attrAllow, … }` shape (attr list → regex,
 * tag added on), or return null if unrecognizable (caller falls back to defaults).
 */
export function coerceSelectorSettings(value: unknown): SelectorSettings | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>

  // Legacy shape (pre-tag, boolean toggles + single ignore regex + attr name list).
  if ("useIds" in v || "useClasses" in v || "useAttrs" in v) {
    return {
      id: { enabled: v.useIds !== false, allow: "", ignore: asString(v.ignoreId) },
      class: { enabled: v.useClasses !== false, allow: "", ignore: asString(v.ignoreClass) },
      attr: {
        enabled: v.useAttrs !== false,
        allow: attrListToRegex(asString(v.attrAllow)),
        ignore: "",
      },
      tag: defaultAnchor(),
    }
  }

  if (isAnchor(v.id) && isAnchor(v.class) && isAnchor(v.attr) && isAnchor(v.tag)) {
    return { id: v.id, class: v.class, attr: v.attr, tag: v.tag }
  }
  return null
}

function composeAnchor(base: SelectorAnchor, over?: SelectorAnchorConfig): SelectorAnchor {
  if (!over) return base
  return {
    // enabled is AND: a layer can only turn an anchor off, never force it back on.
    enabled: base.enabled && (over.enabled ?? true),
    // allow: the override wins when set (the dev's explicit allow); else keep base.
    allow: over.allow ?? base.allow,
    // ignore unions: a name is skipped if either layer ignores it (only tightens).
    ignore: [base.ignore, over.ignore]
      .filter(Boolean)
      .map((r) => `(?:${r})`)
      .join("|"),
  }
}

/**
 * Layer a sparse {@link SelectorConfig} over resolved settings. Anchors compose so
 * each layer can only narrow: `enabled` ANDs, `ignore` unions, `allow` is taken from
 * the override when present. Used to apply the SDK `selector` over the user's saved
 * (or global-default) settings. See DESIGN.md §5.1f.
 */
export function composeSelectorSettings(
  base: SelectorSettings,
  override?: SelectorConfig,
): SelectorSettings {
  if (!override) return base
  return {
    id: composeAnchor(base.id, override.id),
    class: composeAnchor(base.class, override.class),
    attr: composeAnchor(base.attr, override.attr),
    tag: composeAnchor(base.tag, override.tag),
  }
}

/**
 * Resolve the settings a pick starts with (read semantics B): the per-site override
 * if any, else the global default, else built-in — then layer the SDK `selector` on
 * top. See DESIGN.md §5.1f.
 */
export function resolveInitialSettings(
  perSite: SelectorSettings | null,
  global: SelectorSettings | null,
  sdk?: SelectorConfig,
): SelectorSettings {
  return composeSelectorSettings(perSite ?? global ?? defaultSelectorSettings(), sdk)
}
