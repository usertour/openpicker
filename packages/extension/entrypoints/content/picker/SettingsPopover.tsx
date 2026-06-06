import { RiCloseLine, RiLock2Line } from "@remixicon/react"
import { i18n } from "#i18n"
import { SelectorRulesFields } from "./SelectorRulesFields"
import type { SelectorSettings } from "./selectorSettings"

/**
 * Popover from the ⚙️ gear: the selector rules (id / class / attr / tag, each with
 * an enable toggle plus allow/ignore regex). When `readOnly` (the SDK locked the
 * settings) the fields are shown but disabled, with a banner. The editor itself is
 * shared with the options page via {@link SelectorRulesFields}. See DESIGN.md §5.1f.
 */

interface SettingsPopoverProps {
  settings: SelectorSettings
  onChange: (patch: Partial<SelectorSettings>) => void
  onClose: () => void
  /** SDK `lockSelectorSettings`: render the rules read-only (visible, not editable). */
  readOnly?: boolean
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

      <SelectorRulesFields settings={settings} onChange={onChange} readOnly={readOnly} />
    </div>
  )
}
