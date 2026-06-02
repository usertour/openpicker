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
    <div className="absolute right-0 top-9 z-10 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Mode</span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
          title="Close"
        >
          <RiCloseLine size={16} />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 text-xs">
        {(["unique", "list"] as SelectorMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ mode: m })}
            className={`py-1.5 capitalize ${
              settings.mode === m ? "bg-slate-800 text-white" : "bg-white text-slate-600"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="mb-1 block text-xs font-semibold text-slate-700">Exclude</label>
      <input
        type="text"
        value={settings.exclude}
        placeholder="Pattern, e.g. keyword|keyword"
        onChange={(e) => onChange({ exclude: e.target.value })}
        className="mb-3 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
      />

      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={settings.iframe}
          onChange={(e) => onChange({ iframe: e.target.checked })}
        />
        Subframe (iframe) — coming soon
      </label>
    </div>
  )
}
