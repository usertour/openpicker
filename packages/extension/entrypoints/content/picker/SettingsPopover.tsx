import type { SelectorMode } from "@openpicker/protocol"
import { RiCloseLine } from "@remixicon/react"

export interface SelectorSettings {
  mode: SelectorMode
  exclude: string
  iframe: boolean
}

interface SettingsPopoverProps {
  settings: SelectorSettings
  onChange: (patch: Partial<SelectorSettings>) => void
  onClose: () => void
}

/**
 * Popover from the ⚙️ gear controlling how the selector is generated. Maps onto
 * the selector engine config. See DESIGN.md §5.1f.
 */
export function SettingsPopover({ settings, onChange, onClose }: SettingsPopoverProps) {
  return (
    <div className="absolute top-11 right-0 z-10 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-semibold text-[10px] text-slate-400 uppercase tracking-wider">
          Selector mode
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title="Close"
        >
          <RiCloseLine size={15} />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs">
        {(["unique", "list"] as SelectorMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ mode: m })}
            className={`rounded-md py-1.5 font-medium capitalize transition-colors ${
              settings.mode === m
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="mb-1.5 block font-semibold text-[11px] text-slate-600">Exclude</label>
      <input
        type="text"
        value={settings.exclude}
        placeholder="Pattern, e.g. keyword|keyword"
        onChange={(e) => onChange({ exclude: e.target.value })}
        className="mb-3 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />

      <label className="flex items-center gap-2 text-[11px] text-slate-600">
        <input
          type="checkbox"
          checked={settings.iframe}
          onChange={(e) => onChange({ iframe: e.target.checked })}
          className="h-3.5 w-3.5 accent-slate-900"
        />
        <span className="font-medium">Subframe (iframe)</span>
        <span className="text-slate-400">— coming soon</span>
      </label>
    </div>
  )
}
