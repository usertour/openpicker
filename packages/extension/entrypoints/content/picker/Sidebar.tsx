import {
  RiArrowLeftRightLine,
  RiCheckLine,
  RiCloseLine,
  RiCompass3Line,
  RiCrosshair2Line,
  RiCursorLine,
  RiErrorWarningLine,
  RiForbidLine,
  RiSettings3Line,
} from "@remixicon/react"
import { useState } from "react"
import { i18n } from "#i18n"
import { BrandMark, Wordmark } from "@/components/Brand"
import { MaintainedByUsertour } from "@/components/MaintainedBy"
import { AttributeList } from "./AttributeList"
import type { AttrEntry } from "./dom"
import { SelectorField } from "./SelectorField"
import { SettingsPopover } from "./SettingsPopover"
import type { SelectorSettings } from "./selectorSettings"
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
  /** SDK `lockSelectorSettings`: the gear settings are read-only (visible, not editable). */
  lockSelectorSettings?: boolean
  /** SDK `lockSelectorEdit`: the selector field is read-only (no hand-editing). */
  lockSelectorEdit?: boolean
  /** SDK `requireUniqueMatch`: confirm is allowed only when the selector matches exactly one. */
  requireUniqueMatch?: boolean
  /** Hovering a spot with no element matching SDK `mustMatch` — show a "can't select" hint. */
  blocked?: boolean
  /** The locked element falls outside SDK `mustMatch` — block confirming it. */
  targetMismatch?: boolean
  /** The current selector violates the active selector rules — warn and block confirming. */
  ruleMismatch?: boolean
  /** No selector conforms to the rules for this element — warn and block confirming. */
  ruleEmpty?: boolean
}

/**
 * The picker's single panel. It is shown for the whole pick: while hovering it
 * guides the user and previews the selector under the cursor; once an element is
 * locked it becomes the inspector (editable selector, DOM-tree navigator, match
 * count, attribute criteria) with a confirm/close footer. See DESIGN.md §5.1d.
 */
function isFocusable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.tagName) return false
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  )
}

/**
 * Read-only text the user may legitimately want to select & copy (attribute
 * names/values), tagged with data-op-selectable. mousedown on these is left
 * alone so a text selection can begin; every other target stays focus-contained.
 */
function isSelectableText(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el?.closest?.("[data-op-selectable]")
}

// Shared styles for a consistent, refined look.
const iconBtn =
  "grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-accent-50 hover:text-accent-600 dark:text-slate-500 dark:hover:bg-accent-950/40 dark:hover:text-accent-300"
const sectionLabel =
  "px-0.5 font-semibold text-[10px] text-slate-500 uppercase tracking-wider dark:text-slate-400"

export function Sidebar(props: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const locked = props.phase === "locked"
  const navigating = props.phase === "navigate"

  // Keep our interactions inside the panel: a click in the picker must not reach the
  // host page's "close on outside click" or focus handlers (e.g. an open Google menu
  // would otherwise dismiss). We're in Shadow DOM (same document), so unlike an
  // iframe these events would propagate to the page unless we stop them here. Inputs
  // still take focus. (Capture-phase host listeners can't be stopped from here.)
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Don't steal focus from the host page (a focus shift dismisses its focus-managed
    // popovers) — except over inputs, and over read-only text the user may want to
    // select & copy, where letting the selection start is worth the focus shift.
    if (!isFocusable(e.target) && !isSelectableText(e.target)) e.preventDefault()
  }

  return (
    // These handlers only contain events within the panel (stop them reaching the
    // host page); the div is not an interactive control, so the a11y rules below
    // don't apply.
    // biome-ignore lint/a11y/noStaticElementInteractions: event-containment wrapper, not a control
    // biome-ignore lint/a11y/useKeyWithClickEvents: click handler only stops propagation
    <div
      onPointerDown={stop}
      onMouseDown={onMouseDown}
      onClick={stop}
      style={{ background: "var(--op-panel)" }}
      className={`fixed top-3 bottom-3 z-[2147483646] flex w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 font-sans text-slate-800 antialiased shadow-[0_20px_60px_-15px_rgba(15,15,40,0.5)] dark:border-slate-800 dark:text-slate-200 ${
        props.side === "right" ? "right-3" : "left-3"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-slate-200 border-b px-3 py-2.5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <BrandMark className="h-6 w-6" />
          <Wordmark className="text-base" />
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip label={i18n.t("picker.swapSide")} align="end">
            <button type="button" onClick={props.onSwapSide} className={iconBtn}>
              <RiArrowLeftRightLine size={16} />
            </button>
          </Tooltip>
          {props.canNavigate && !navigating && (
            <Tooltip label={i18n.t("picker.navigateAway")} align="end">
              <button type="button" onClick={props.onNavigate} className={iconBtn}>
                <RiCompass3Line size={16} />
              </button>
            </Tooltip>
          )}
          {locked && (
            <Tooltip label={i18n.t("picker.selectorSettings")} align="end">
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                className={
                  settingsOpen
                    ? `${iconBtn} bg-accent-100 text-accent-700 dark:bg-accent-950/60 dark:text-accent-200`
                    : iconBtn
                }
              >
                <RiSettings3Line size={16} />
              </button>
            </Tooltip>
          )}
          <Tooltip label={i18n.t("picker.close")} align="end">
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
          readOnly={props.lockSelectorSettings}
        />
      )}

      {navigating ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <RiCompass3Line size={24} />
          </span>
          <p className="max-w-[15rem] text-slate-600 text-sm leading-relaxed dark:text-slate-300">
            {i18n.t("picker.paused")}
          </p>
          <button
            type="button"
            onClick={props.onResume}
            style={{ background: "var(--op-accent-grad)" }}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-medium text-sm text-white shadow-lg shadow-accent-600/30 outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-accent-400"
          >
            <RiCrosshair2Line size={16} />
            {i18n.t("picker.resume")}
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-3">
          {!locked &&
            (props.blocked ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-amber-700 text-xs dark:bg-amber-950/40 dark:text-amber-300">
                <RiForbidLine size={15} className="shrink-0" />
                {i18n.t("picker.noMatchingTarget")}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-slate-500 text-xs dark:bg-slate-800 dark:text-slate-400">
                <RiCursorLine size={15} className="shrink-0 text-slate-400 dark:text-slate-500" />
                {i18n.t("picker.hoverHint")}
              </div>
            ))}

          {/* Selector: read-only live preview while hovering, editable once locked */}
          <div className="flex flex-col gap-1.5">
            <span className={sectionLabel}>{i18n.t("picker.selectorLabel")}</span>
            <div className="relative flex items-start gap-1.5">
              <SelectorField
                value={props.selector}
                editable={locked && !props.lockSelectorEdit}
                lockedBySite={locked && !!props.lockSelectorEdit}
                placeholder={locked ? "" : i18n.t("picker.hoverPlaceholder")}
                onChange={props.onSelectorChange}
                matchCount={props.matchCount}
                selectorValid={props.selectorValid}
              />
              {locked && (
                <Tooltip label={i18n.t("picker.pickAnother")} align="end">
                  <button
                    type="button"
                    onClick={props.onReselect}
                    className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-500 transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-accent-700 dark:hover:bg-accent-950/40 dark:hover:text-accent-300"
                  >
                    <RiCrosshair2Line size={16} />
                  </button>
                </Tooltip>
              )}
            </div>
            {(props.ruleMismatch || props.ruleEmpty) && (
              <p className="flex items-start gap-1.5 text-amber-700 text-xs leading-snug dark:text-amber-300">
                <RiErrorWarningLine size={13} className="mt-0.5 shrink-0" />
                {i18n.t(props.ruleEmpty ? "picker.ruleEmpty" : "picker.ruleMismatch")}
              </p>
            )}
          </div>

          {/* Inspector tools (locked only) */}
          {locked && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={sectionLabel}>{i18n.t("picker.elementLabel")}</span>
                <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                  <TreeNavigator {...props.tree} />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                <span className={sectionLabel}>{i18n.t("picker.attributesLabel")}</span>
                <AttributeList attributes={props.attributes} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer: persistent Usertour attribution on the left; confirm actions appear
          on the right once an element is locked. The bar is always shown so the
          credit stays pinned to the bottom-left in every phase. */}
      <div className="flex items-center justify-between gap-2 border-slate-200 border-t px-3 py-2 dark:border-slate-800">
        <MaintainedByUsertour />
        {locked && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={props.onCancel}
              className="rounded-lg px-3 py-2 font-medium text-slate-600 text-sm transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {i18n.t("picker.close")}
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              disabled={
                props.confirmDone ||
                (!!props.requireUniqueMatch && props.matchCount !== 1) ||
                !!props.targetMismatch ||
                !!props.ruleMismatch ||
                !!props.ruleEmpty
              }
              title={
                props.targetMismatch
                  ? i18n.t("picker.noMatchingTarget")
                  : props.ruleEmpty
                    ? i18n.t("picker.ruleEmpty")
                    : props.ruleMismatch
                      ? i18n.t("picker.ruleMismatch")
                      : props.requireUniqueMatch && props.matchCount !== 1
                        ? i18n.t("settings.requireUnique")
                        : undefined
              }
              style={props.confirmDone ? undefined : { background: "var(--op-accent-grad)" }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-medium text-sm text-white shadow-lg outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
                props.confirmDone
                  ? "bg-emerald-600 shadow-emerald-600/30"
                  : "shadow-accent-600/30 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-accent-400"
              }`}
            >
              {props.confirmDone ? (
                <>
                  <RiCheckLine size={16} />
                  {i18n.t("picker.copied")}
                </>
              ) : (
                (props.confirmLabel ?? i18n.t("picker.ok"))
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
