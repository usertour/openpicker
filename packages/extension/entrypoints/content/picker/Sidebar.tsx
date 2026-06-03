import {
  RiArrowLeftRightLine,
  RiCheckLine,
  RiCloseLine,
  RiCompass3Line,
  RiCrosshair2Line,
  RiCursorLine,
  RiErrorWarningLine,
  RiSettings3Line,
} from "@remixicon/react"
import { useState } from "react"
import { BrandMark, Wordmark } from "@/components/Brand"
import { AttributeList } from "./AttributeList"
import type { AttrEntry } from "./dom"
import { type SelectorSettings, SettingsPopover } from "./SettingsPopover"
import { Tooltip } from "./Tooltip"
import { TreeNavigator } from "./TreeNavigator"

interface SidebarProps {
  /**
   * "hover" = still finding an element; "locked" = an element is selected;
   * "navigate" = the pick is suspended so the user can navigate to another page.
   */
  phase: "hover" | "locked" | "navigate"
  /** The current selector: live preview while hovering, editable once locked. */
  selector: string
  matchCount: number
  /** False when the selector is not valid CSS (querySelectorAll would throw). */
  selectorValid: boolean
  attributes: AttrEntry[]
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
    onCenter: () => void
  }
  onSelectorChange: (value: string) => void
  onSettingsChange: (patch: Partial<SelectorSettings>) => void
  onSwapSide: () => void
  /** Return to hover mode to pick a different element. */
  onReselect: () => void
  /**
   * Whether to offer "navigate to another page" (only safe in the cross-tab target
   * tab, where the pick resumes after navigation). See Picker `canNavigate`.
   */
  canNavigate: boolean
  /** Suspend the pick so the page is interactive and the user can navigate away. */
  onNavigate: () => void
  /** Resume picking after navigating (back to hover mode). */
  onResume: () => void
  onConfirm: () => void
  onCancel: () => void
  /** Label for the confirm button (e.g. "OK" for SDK picks, "Copy" for toolbar picks). */
  confirmLabel?: string
  /** When true, the confirm button shows a transient "Copied" success state. */
  confirmDone?: boolean
}

/**
 * The picker's single panel. It is shown for the whole pick: while hovering it
 * guides the user and previews the selector under the cursor; once an element is
 * locked it becomes the inspector (editable selector, DOM-tree navigator, match
 * count, attribute criteria) with a confirm/close footer. See DESIGN.md §5.1d.
 */
function isFocusable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  )
}

// Shared styles for a consistent, refined look.
const iconBtn =
  "grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
const sectionLabel = "px-0.5 font-semibold text-[10px] text-slate-500 uppercase tracking-wider"

export function Sidebar(props: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const locked = props.phase === "locked"
  const navigating = props.phase === "navigate"
  const matchOk = props.matchCount === 1

  // Keep our interactions inside the panel: a click in the picker must not reach the
  // host page's "close on outside click" or focus handlers (e.g. an open Google menu
  // would otherwise dismiss). We're in Shadow DOM (same document), so unlike an
  // iframe these events would propagate to the page unless we stop them here. Inputs
  // still take focus. (Capture-phase host listeners can't be stopped from here.)
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isFocusable(e.target)) e.preventDefault() // don't steal focus from the host page
  }

  return (
    <div
      onPointerDown={stop}
      onMouseDown={onMouseDown}
      onClick={stop}
      className={`fixed top-0 z-[2147483646] flex h-screen w-80 flex-col bg-white text-slate-800 antialiased shadow-2xl ${
        props.side === "right" ? "right-0 border-slate-200 border-l" : "left-0 border-slate-200 border-r"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-slate-200 border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <BrandMark className="h-6 w-6" glyph={14} />
          <Wordmark className="text-sm" />
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip label="Swap side" align="end">
            <button type="button" onClick={props.onSwapSide} className={iconBtn}>
              <RiArrowLeftRightLine size={16} />
            </button>
          </Tooltip>
          {props.canNavigate && !navigating && (
            <Tooltip label="Navigate to another page" align="end">
              <button type="button" onClick={props.onNavigate} className={iconBtn}>
                <RiCompass3Line size={16} />
              </button>
            </Tooltip>
          )}
          {locked && (
            <Tooltip label="Selector settings" align="end">
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                className={settingsOpen ? `${iconBtn} bg-slate-100 text-slate-700` : iconBtn}
              >
                <RiSettings3Line size={16} />
              </button>
            </Tooltip>
          )}
          <Tooltip label="Close" align="end">
            <button type="button" onClick={props.onCancel} className={iconBtn}>
              <RiCloseLine size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Settings popover (drops from the gear in the header) */}
      {locked && settingsOpen && (
        <SettingsPopover
          settings={props.settings}
          onChange={props.onSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {navigating ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
            <RiCompass3Line size={24} />
          </span>
          <p className="max-w-[15rem] text-slate-600 text-sm leading-relaxed">
            Picking is paused. Go to the page that has your element, then resume.
          </p>
          <button
            type="button"
            onClick={props.onResume}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 font-medium text-sm text-white shadow-sm transition-colors hover:bg-slate-700"
          >
            <RiCrosshair2Line size={16} />
            Resume picking
          </button>
        </div>
      ) : (
        <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-3">
        {!locked && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-slate-500 text-xs">
            <RiCursorLine size={15} className="shrink-0 text-slate-400" />
            Move your mouse and click an element to select it.
          </div>
        )}

        {/* Selector: read-only live preview while hovering, editable once locked */}
        <div className="flex flex-col gap-1.5">
          <span className={sectionLabel}>Selector</span>
          <div className="relative flex items-center gap-1.5">
            <input
              type="text"
              value={props.selector}
              readOnly={!locked}
              placeholder={locked ? "" : "hover an element…"}
              onChange={(e) => props.onSelectorChange(e.target.value)}
              className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 font-mono text-xs outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${
                locked
                  ? "border-slate-300 bg-white text-slate-800"
                  : "border-slate-300 bg-slate-50 text-slate-500"
              }`}
            />
            {locked && (
              <Tooltip label="Pick another element" align="end">
                <button
                  type="button"
                  onClick={props.onReselect}
                  className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                >
                  <RiCrosshair2Line size={16} />
                </button>
              </Tooltip>
            )}
          </div>

          {/* Match count / validity */}
          {props.selector &&
            (!props.selectorValid ? (
              <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-medium text-[11px] text-rose-600">
                <RiErrorWarningLine size={12} />
                Invalid selector
              </span>
            ) : (
              <span
                className={`mt-0.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[11px] ${
                  matchOk ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {matchOk ? <RiCheckLine size={12} /> : <RiErrorWarningLine size={12} />}
                {props.matchCount} match{props.matchCount === 1 ? "" : "es"}
              </span>
            ))}
        </div>

        {/* Inspector tools (locked only) */}
        {locked && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className={sectionLabel}>Element</span>
              <div className="rounded-xl border border-slate-200 bg-slate-50">
                <TreeNavigator {...props.tree} />
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <span className={sectionLabel}>Attributes</span>
              <AttributeList attributes={props.attributes} />
            </div>
          </>
        )}
      </div>

      {/* Footer (locked only) */}
      {locked && (
        <div className="flex justify-end gap-2 border-slate-200 border-t px-3 py-2.5">
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded-lg px-3.5 py-2 font-medium text-slate-600 text-sm transition-colors hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            disabled={props.confirmDone}
            className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2 font-medium text-sm text-white shadow-sm transition-colors ${
              props.confirmDone ? "bg-emerald-600" : "bg-slate-900 hover:bg-slate-700"
            }`}
          >
            {props.confirmDone ? (
              <>
                <RiCheckLine size={16} />
                Copied
              </>
            ) : (
              (props.confirmLabel ?? "OK")
            )}
          </button>
        </div>
      )}
        </>
      )}
    </div>
  )
}
