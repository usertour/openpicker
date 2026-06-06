import type { SelectorAnchor, SelectorRules, SelectorRulesDimension } from "./model"

/**
 * The selector-rules editor: an enable toggle plus an allow and an ignore regex for
 * each anchor type (id / class / attr / tag). Single source of truth, shared by the
 * extension (gear popover + options page, which inject localized {@link labels}) and
 * the demo/playground apps. Styling uses the host's Tailwind theme: neutral slate +
 * the `accent-*` token (define it in the host, or it falls back to unstyled). See
 * DESIGN.md §5.1f.
 */

export interface SelectorRulesLabels {
  enableId: string
  enableClass: string
  enableAttribute: string
  enableTag: string
  allow: string
  ignore: string
  regexHint: string
}

export const defaultSelectorRulesLabels: SelectorRulesLabels = {
  enableId: "Enable ID",
  enableClass: "Enable Class",
  enableAttribute: "Enable Attribute",
  enableTag: "Enable tag",
  allow: "Allow",
  ignore: "Ignore",
  regexHint: "Regex of names. Allow = only matches; Ignore = never matches. Empty = smart default.",
}

interface DimSpec {
  key: SelectorRulesDimension
  labelKey: keyof SelectorRulesLabels
  allowPlaceholder: string
  ignorePlaceholder: string
}

// Example/regex placeholders stay in English (not localized).
const DIMS: DimSpec[] = [
  {
    key: "id",
    labelKey: "enableId",
    allowPlaceholder: "e.g. ^app-",
    ignorePlaceholder: "e.g. ^ember|^radix-",
  },
  {
    key: "class",
    labelKey: "enableClass",
    allowPlaceholder: "e.g. ^btn",
    ignorePlaceholder: "e.g. css-|sc-|jsx-",
  },
  {
    key: "attr",
    labelKey: "enableAttribute",
    allowPlaceholder: "e.g. ^data-testid$",
    ignorePlaceholder: "e.g. ^data-reactid$",
  },
  {
    key: "tag",
    labelKey: "enableTag",
    allowPlaceholder: "",
    ignorePlaceholder: "e.g. ^(div|span)$",
  },
]

const fieldClass =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:placeholder:text-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-accent-500 dark:focus:ring-accent-500/30 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
const inputLabel = "text-[9px] text-slate-400 uppercase tracking-wider dark:text-slate-500"

function AnchorRow({
  spec,
  label,
  allowLabel,
  ignoreLabel,
  anchor,
  readOnly,
  onChange,
}: {
  spec: DimSpec
  label: string
  allowLabel: string
  ignoreLabel: string
  anchor: SelectorAnchor
  readOnly: boolean
  onChange: (next: SelectorAnchor) => void
}) {
  const disabled = readOnly || !anchor.enabled
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 font-medium text-slate-700 text-xs dark:text-slate-200">
        <input
          type="checkbox"
          checked={anchor.enabled}
          disabled={readOnly}
          onChange={(e) => onChange({ ...anchor, enabled: e.target.checked })}
          className="h-3.5 w-3.5 accent-accent-600 disabled:opacity-50 dark:accent-accent-500"
        />
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className={inputLabel}>{allowLabel}</span>
          <input
            type="text"
            value={anchor.allow}
            disabled={disabled}
            placeholder={spec.allowPlaceholder}
            onChange={(e) => onChange({ ...anchor, allow: e.target.value })}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={inputLabel}>{ignoreLabel}</span>
          <input
            type="text"
            value={anchor.ignore}
            disabled={disabled}
            placeholder={spec.ignorePlaceholder}
            onChange={(e) => onChange({ ...anchor, ignore: e.target.value })}
            className={fieldClass}
          />
        </div>
      </div>
    </div>
  )
}

export function SelectorRulesFields({
  value,
  onChange,
  labels,
  readOnly = false,
}: {
  value: SelectorRules
  onChange: (patch: Partial<SelectorRules>) => void
  labels?: Partial<SelectorRulesLabels>
  readOnly?: boolean
}) {
  const l = { ...defaultSelectorRulesLabels, ...labels }
  return (
    <div className="flex flex-col gap-3">
      {DIMS.map((spec) => (
        <AnchorRow
          key={spec.key}
          spec={spec}
          label={l[spec.labelKey]}
          allowLabel={l.allow}
          ignoreLabel={l.ignore}
          anchor={value[spec.key]}
          readOnly={readOnly}
          onChange={(next) => onChange({ [spec.key]: next })}
        />
      ))}
      <p className="px-0.5 text-[10px] text-slate-400 leading-snug dark:text-slate-500">
        {l.regexHint}
      </p>
    </div>
  )
}
