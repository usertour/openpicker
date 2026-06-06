import { i18n } from "#i18n"
import type { SelectorAnchor, SelectorDimension, SelectorSettings } from "./selectorSettings"

/**
 * The selector-rules editor: an enable toggle plus an allow and an ignore regex for
 * each anchor type (id / class / attr / tag). Shared by the picker's gear popover
 * and the options page (global default + per-site overrides), so the model is
 * edited identically everywhere. See DESIGN.md §5.1f.
 */

interface DimSpec {
  key: SelectorDimension
  label: string
  allowPlaceholder: string
  ignorePlaceholder: string
}

// Example/regex placeholders stay in English (not localized).
const DIMS: DimSpec[] = [
  {
    key: "id",
    label: i18n.t("settings.enableId"),
    allowPlaceholder: "e.g. ^app-",
    ignorePlaceholder: "e.g. ^ember|^radix-",
  },
  {
    key: "class",
    label: i18n.t("settings.enableClass"),
    allowPlaceholder: "e.g. ^btn",
    ignorePlaceholder: "e.g. css-|sc-|jsx-",
  },
  {
    key: "attr",
    label: i18n.t("settings.enableAttribute"),
    allowPlaceholder: "e.g. ^data-testid$",
    ignorePlaceholder: "e.g. ^data-reactid$",
  },
  {
    key: "tag",
    label: i18n.t("settings.enableTag"),
    allowPlaceholder: "",
    ignorePlaceholder: "e.g. ^(div|span)$",
  },
]

const fieldClass =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:placeholder:text-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-accent-500 dark:focus:ring-accent-500/30 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
const inputLabel = "text-[9px] text-slate-400 uppercase tracking-wider dark:text-slate-500"

function AnchorRow({
  spec,
  anchor,
  readOnly,
  onChange,
}: {
  spec: DimSpec
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
        {spec.label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className={inputLabel}>{i18n.t("settings.allow")}</span>
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
          <span className={inputLabel}>{i18n.t("settings.ignore")}</span>
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
  settings,
  onChange,
  readOnly = false,
}: {
  settings: SelectorSettings
  onChange: (patch: Partial<SelectorSettings>) => void
  readOnly?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      {DIMS.map((spec) => (
        <AnchorRow
          key={spec.key}
          spec={spec}
          anchor={settings[spec.key]}
          readOnly={readOnly}
          onChange={(next) => onChange({ [spec.key]: next })}
        />
      ))}
      <p className="px-0.5 text-[10px] text-slate-400 leading-snug dark:text-slate-500">
        {i18n.t("settings.regexHint")}
      </p>
    </div>
  )
}
