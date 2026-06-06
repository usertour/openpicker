import { RiCloseLine, RiLock2Line } from "@remixicon/react"
import { i18n } from "#i18n"
import type { SelectorAnchor, SelectorDimension, SelectorSettings } from "./selectorSettings"

/**
 * Popover from the ⚙️ gear: which parts of the element the generated selector may
 * use (id / class / attribute / tag), each with an enable toggle plus an allow and
 * an ignore regex. Maps onto finder's idName / className / attr / tagName
 * predicates. When `readOnly` (the SDK locked the settings) the controls are shown
 * but disabled, with a banner. See DESIGN.md §5.1f.
 */

interface SettingsPopoverProps {
  settings: SelectorSettings
  onChange: (patch: Partial<SelectorSettings>) => void
  onClose: () => void
  /** SDK `lockSelectorSettings`: render the rules read-only (visible, not editable). */
  readOnly?: boolean
}

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

export function SettingsPopover({
  settings,
  onChange,
  onClose,
  readOnly = false,
}: SettingsPopoverProps) {
  return (
    <div className="absolute top-11 right-0 left-0 z-20 border-slate-200 border-b bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-[10px] text-slate-500 uppercase tracking-wider dark:text-slate-400">
          {i18n.t("settings.allowSelectorTypes")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-accent-50 hover:text-accent-600 dark:text-slate-500 dark:hover:bg-accent-950/40 dark:hover:text-accent-300"
          title={i18n.t("picker.close")}
        >
          <RiCloseLine size={15} />
        </button>
      </div>

      {readOnly && (
        <div className="mb-3 flex items-center gap-1.5 rounded-md bg-accent-50 px-2.5 py-1.5 font-medium text-[11px] text-accent-700 dark:bg-accent-950/40 dark:text-accent-300">
          <RiLock2Line size={13} className="shrink-0" />
          {i18n.t("settings.lockedBySite")}
        </div>
      )}

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
      </div>

      <p className="mt-3 px-0.5 text-[10px] text-slate-400 leading-snug dark:text-slate-500">
        {i18n.t("settings.regexHint")}
      </p>
    </div>
  )
}
