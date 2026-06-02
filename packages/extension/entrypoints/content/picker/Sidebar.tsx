import {
  RiArrowLeftRightLine,
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiSettings3Line,
} from "@remixicon/react"
import { useState } from "react"
import { AttributeList } from "./AttributeList"
import type { AttrEntry } from "./dom"
import { type SelectorSettings, SettingsPopover } from "./SettingsPopover"
import { TreeNavigator } from "./TreeNavigator"

interface SidebarProps {
  /** "hover" = still finding an element; "locked" = an element is selected. */
  phase: "hover" | "locked"
  /** The current selector: live preview while hovering, editable once locked. */
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

/**
 * The picker's single panel. It is shown for the whole pick: while hovering it
 * guides the user and previews the selector under the cursor; once an element is
 * locked it becomes the inspector (editable selector, DOM-tree navigator, match
 * count, attribute criteria) with a confirm/close footer. See DESIGN.md §5.1d.
 */
export function Sidebar(props: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const locked = props.phase === "locked"
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
          <RiArrowLeftRightLine size={16} />
        </button>
        <span className="text-sm font-semibold text-slate-800">openpicker</span>
        <button
          type="button"
          onClick={props.onCancel}
          title="Close"
          className="text-slate-400 hover:text-slate-600"
        >
          <RiCloseLine size={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        {!locked && (
          <p className="text-sm text-slate-500">
            Move your mouse and click an element to select it.
          </p>
        )}

        {/* Selector: read-only live preview while hovering, editable once locked */}
        <div className="relative flex items-center gap-1">
          <input
            type="text"
            value={props.selector}
            readOnly={!locked}
            placeholder={locked ? "" : "hover an element…"}
            onChange={(e) => props.onSelectorChange(e.target.value)}
            className={`min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs outline-none focus:border-slate-400 ${
              locked ? "" : "bg-slate-50 text-slate-500"
            }`}
          />
          {locked && (
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              title="Selector settings"
              className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-slate-600 hover:bg-slate-50"
            >
              <RiSettings3Line size={16} />
            </button>
          )}
          {locked && settingsOpen && (
            <SettingsPopover
              settings={props.settings}
              onChange={props.onSettingsChange}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>

        {/* Match count (shown in both phases) */}
        {props.selector && (
          <div
            className={`flex items-center justify-center gap-1 text-xs font-medium ${matchColor}`}
          >
            {matchOk ? <RiCheckLine size={14} /> : <RiErrorWarningLine size={14} />}
            Found {props.matchCount} element{props.matchCount === 1 ? "" : "s"}
          </div>
        )}

        {/* Inspector tools (locked only) */}
        {locked && (
          <>
            <div className="rounded-xl border border-slate-200">
              <TreeNavigator {...props.tree} />
            </div>
            <AttributeList
              attributes={props.attributes}
              checked={props.checkedCriteria}
              onToggle={props.onToggleCriterion}
            />
          </>
        )}
      </div>

      {/* Footer (locked only) */}
      {locked && (
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
      )}
    </div>
  )
}
