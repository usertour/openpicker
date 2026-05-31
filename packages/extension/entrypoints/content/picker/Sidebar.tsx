import { useState } from "react"
import { AttributeList } from "./AttributeList"
import type { AttrEntry } from "./dom"
import { SettingsPopover, type SelectorSettings } from "./SettingsPopover"
import { TreeNavigator } from "./TreeNavigator"

interface SidebarProps {
  selector: string
  matchCount: number
  attributes: AttrEntry[]
  checkedCriteria: Set<string>
  settings: SelectorSettings
  side: "left" | "right"
  tree: {
    parentLabel: string | null
    prevLabel: string | null
    currentLabel: string
    nextLabel: string | null
    childLabel: string | null
    onParent: () => void
    onPrev: () => void
    onNext: () => void
    onChild: () => void
  }
  onSelectorChange: (value: string) => void
  onToggleCriterion: (name: string) => void
  onSettingsChange: (patch: Partial<SelectorSettings>) => void
  onSwapSide: () => void
  onConfirm: () => void
  onCancel: () => void
}

/** The post-selection inspector panel. See DESIGN.md §5.1d. */
export function Sidebar(props: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const matchOk = props.matchCount === 1
  const matchColor = matchOk ? "text-emerald-600" : "text-amber-600"

  return (
    <div
      className={`fixed top-0 z-[2147483646] flex h-screen w-80 flex-col bg-white shadow-2xl ${
        props.side === "right" ? "right-0" : "left-0"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <button
          type="button"
          onClick={props.onSwapSide}
          title="Swap side"
          className="text-slate-400 hover:text-slate-600"
        >
          ⇄
        </button>
        <span className="text-sm font-semibold text-slate-800">openpicker</span>
        <button
          type="button"
          onClick={props.onCancel}
          title="Close"
          className="text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        {/* Editable selector + settings gear */}
        <div className="relative flex items-center gap-1">
          <input
            type="text"
            value={props.selector}
            onChange={(e) => props.onSelectorChange(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs outline-none focus:border-slate-400"
          />
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            title="Selector settings"
            className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50"
          >
            ⚙
          </button>
          {settingsOpen && (
            <SettingsPopover
              settings={props.settings}
              onChange={props.onSettingsChange}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>

        {/* DOM tree navigator */}
        <div className="rounded-xl border border-slate-200">
          <TreeNavigator {...props.tree} />
        </div>

        {/* Match count */}
        <div className={`text-center text-xs font-medium ${matchColor}`}>
          {matchOk ? "✓ " : "⚠ "}
          Found {props.matchCount} element{props.matchCount === 1 ? "" : "s"}
        </div>

        {/* Attributes */}
        <AttributeList
          attributes={props.attributes}
          checked={props.checkedCriteria}
          onToggle={props.onToggleCriterion}
        />
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-slate-200 px-3 py-2">
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
        <button
          type="button"
          onClick={props.onConfirm}
          className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          OK
        </button>
      </div>
    </div>
  )
}
