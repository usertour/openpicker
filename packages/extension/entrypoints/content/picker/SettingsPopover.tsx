import { RiCloseLine } from "@remixicon/react"
import { AUTO_ATTRS } from "./selector"

export interface SelectorSettings {
  /** Whether the selector may use the element's id. */
  useIds: boolean
  /** Whether the selector may use the element's classes. */
  useClasses: boolean
  /** Whether the selector may use the element's attributes. */
  useAttrs: boolean
  /** Regex of id names to ignore (when IDs are enabled). */
  ignoreId: string
  /** Regex of class names to ignore (when classes are enabled). */
  ignoreClass: string
  /** Attribute names to allow, comma/space/pipe-separated. Empty = a sensible default. */
  attrAllow: string
}

/** Fresh settings: all anchor types on, nothing ignored, attributes auto. */
export function defaultSelectorSettings(): SelectorSettings {
  return {
    useIds: true,
    useClasses: true,
    useAttrs: true,
    ignoreId: "",
    ignoreClass: "",
    attrAllow: "",
  }
}

interface SettingsPopoverProps {
  settings: SelectorSettings
  onChange: (patch: Partial<SelectorSettings>) => void
  onClose: () => void
}

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-[11px] outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:placeholder:text-slate-300"
const hintClass = "px-0.5 text-[10px] text-slate-400 leading-snug"

/**
 * Popover from the ⚙️ gear: which parts of the element the generated selector may
 * use (id / class / attributes), each with its own ignore/allow filter. Maps onto
 * @medv/finder's idName / className / attr predicates. See DESIGN.md §5.1f.
 */
export function SettingsPopover({ settings, onChange, onClose }: SettingsPopoverProps) {
  return (
    <div className="absolute top-11 right-0 left-0 z-20 border-slate-200 border-b bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-[10px] text-slate-500 uppercase tracking-wider">
          Allow selector types
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

      <div className="flex flex-col gap-3">
        {/* ID */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 font-medium text-slate-700 text-xs">
            <input
              type="checkbox"
              checked={settings.useIds}
              onChange={(e) => onChange({ useIds: e.target.checked })}
              className="h-3.5 w-3.5 accent-slate-900"
            />
            Enable ID
          </label>
          <input
            type="text"
            value={settings.ignoreId}
            disabled={!settings.useIds}
            placeholder="e.g. ^ember|^radix-"
            onChange={(e) => onChange({ ignoreId: e.target.value })}
            className={fieldClass}
          />
          <p className={hintClass}>
            Use the element's id. The box is a regex of id names to ignore (e.g.{" "}
            <code>^ember|^radix-</code> for auto-generated ids).
          </p>
        </div>

        {/* Class */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 font-medium text-slate-700 text-xs">
            <input
              type="checkbox"
              checked={settings.useClasses}
              onChange={(e) => onChange({ useClasses: e.target.checked })}
              className="h-3.5 w-3.5 accent-slate-900"
            />
            Enable Class
          </label>
          <input
            type="text"
            value={settings.ignoreClass}
            disabled={!settings.useClasses}
            placeholder="e.g. css-|sc-|jsx-"
            onChange={(e) => onChange({ ignoreClass: e.target.value })}
            className={fieldClass}
          />
          <p className={hintClass}>
            Use class names. The box is a regex of class names to ignore (e.g.{" "}
            <code>css-|sc-|jsx-</code> for hashed classes).
          </p>
        </div>

        {/* Attribute */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 font-medium text-slate-700 text-xs">
            <input
              type="checkbox"
              checked={settings.useAttrs}
              onChange={(e) => onChange({ useAttrs: e.target.checked })}
              className="h-3.5 w-3.5 accent-slate-900"
            />
            Enable Attribute
          </label>
          <input
            type="text"
            value={settings.attrAllow}
            disabled={!settings.useAttrs}
            placeholder="e.g. data-testid, name"
            onChange={(e) => onChange({ attrAllow: e.target.value })}
            className={fieldClass}
          />
          <p className={hintClass}>
            {settings.attrAllow.trim()
              ? "Only these attribute names are used (any value)."
              : `Attribute names to use, e.g. "data-testid, name". Empty = auto: ${AUTO_ATTRS.join(", ")} (stable values only).`}
          </p>
        </div>
      </div>
    </div>
  )
}
