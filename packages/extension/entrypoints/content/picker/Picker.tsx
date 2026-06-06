import type { PickParams, PickResult } from "@openpicker/protocol"
import { useCallback, useEffect, useMemo, useState } from "react"
import { i18n } from "#i18n"
import {
  collectAttributes,
  describeElement,
  getFirstChild,
  getNextSibling,
  getParent,
  getPrevSibling,
  matchesTarget,
  resolveTarget,
  tagLabel,
} from "./dom"
import { HighlightBox } from "./HighlightBox"
import { applyHostCursor, clearHostCursor, setHostCursorBlocked } from "./hostCursor"
import { isNavigateMode, setNavigateMode } from "./navigateMode"
import { RulerGuides } from "./RulerGuides"
import type { PickOutcome } from "./run"
import { Sidebar } from "./Sidebar"
import { captureScreenshot, normalizeScreenshotMode } from "./screenshot"
import {
  conformsToSettings,
  matchCount as countMatches,
  evalSelector,
  generateSelector,
  hasSelectorRules,
} from "./selector"
import type { SelectorSettings } from "./selectorSettings"
import { saveSelectorSettings } from "./settingsStore"
import { TagTooltip } from "./TagTooltip"
import { useTrackedRect } from "./useTrackedRect"

type Phase = "hover" | "locked" | "navigate"

interface PickerProps {
  /** Picker-side options (screenshot/appName); `url` is not used here. */
  params: Partial<PickParams>
  /** Our shadow host element, excluded from targeting. */
  host: Element
  /**
   * Allow suspending the pick to navigate the page (Alt+S). Only safe in the
   * cross-tab target tab: the pick resumes after navigation and the result is
   * routed back via the background. In a same-tab pick, navigating would destroy
   * the requester, so this stays off.
   */
  canNavigate?: boolean
  /**
   * Toolbar (same-tab, human) pick: there is no SDK caller to receive the result,
   * so confirming copies the selector to the clipboard instead of returning it.
   */
  copyOnConfirm?: boolean
  /** Initial selector settings (loaded per-origin). */
  initialSettings: SelectorSettings
  onResolve: (outcome: PickOutcome) => void
}

export function Picker({
  params,
  host,
  canNavigate,
  copyOnConfirm,
  initialSettings,
  onResolve,
}: PickerProps) {
  // Resume straight into navigate mode if a navigation happened mid-pick while the
  // user was navigating (the flag rides the target tab's sessionStorage); otherwise
  // start hovering. Authorization is decided before the picker is launched (see the
  // content connector); the picker itself does not gate.
  const [phase, setPhase] = useState<Phase>(() =>
    canNavigate && isNavigateMode() ? "navigate" : "hover",
  )
  const [hovered, setHovered] = useState<Element | null>(null)
  const [locked, setLocked] = useState<Element | null>(null)
  const [side, setSide] = useState<"left" | "right">("right")
  const [settings, setSettings] = useState<SelectorSettings>(initialSettings)
  const [selector, setSelector] = useState("")
  const [selectorEdited, setSelectorEdited] = useState(false)
  const [copied, setCopied] = useState(false)
  // SDK `mustMatch`: only elements matching this CSS selector are selectable.
  const mustMatch = params.mustMatch?.trim() || undefined
  // True while hovering a spot with no matching element (not selectable here).
  const [blocked, setBlocked] = useState(false)

  const hoverRect = useTrackedRect(phase === "hover" ? hovered : null)
  const lockedRect = useTrackedRect(phase === "locked" ? locked : null)

  const cancel = useCallback(() => onResolve({ type: "cancelled" }), [onResolve])

  // Capture-phase page listeners during the hover phase. See DESIGN.md §5.1.
  useEffect(() => {
    if (phase !== "hover") return

    const insideUs = (t: EventTarget | null) =>
      t instanceof Node && (t === host || host.contains(t))

    const onMove = (e: MouseEvent) => {
      const t = e.target
      if (insideUs(t)) return
      if (t instanceof Element) {
        // Snap to the nearest element matching `mustMatch` (incl. self); null = not
        // selectable here → no highlight, and the cursor/hint go to "blocked".
        const eff = resolveTarget(t, mustMatch)
        setHovered(eff)
        setBlocked(!!mustMatch && eff === null)
      }
    }
    // Select on click and cancel that same click, so a link/button can never
    // navigate or activate. Selecting on pointerdown instead would leave the
    // browser's own click to fire after React tears these listeners down
    // (passive effects flush between pointerdown and click in one gesture).
    const onClick = (e: MouseEvent) => {
      if (insideUs(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.target instanceof Element) {
        // Lock onto the nearest matching element; ignore the click entirely when
        // nothing in the chain matches `mustMatch` (you can't select here).
        const eff = resolveTarget(e.target, mustMatch)
        if (!eff) return
        setLocked(eff)
        setSelectorEdited(false)
        setPhase("locked")
      }
    }
    // Right-click cancels the pick (and never opens the page's context menu).
    const onContextMenu = (e: MouseEvent) => {
      if (insideUs(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      cancel()
    }
    const swallow = (e: Event) => {
      if (insideUs(e.target)) return
      e.preventDefault()
      e.stopPropagation()
    }
    const onKey = (e: KeyboardEvent) => {
      // Neutralize the page's keyboard shortcuts while picking; let Esc cancel.
      e.preventDefault()
      e.stopPropagation()
      if (e.key === "Escape") cancel()
    }

    // Swallow the rest of the gesture at capture phase so the page can't move
    // focus, drag, submit, or run mousedown-driven widgets. preventDefault on
    // mousedown blocks the focus shift while still letting our click fire.
    const SWALLOW = [
      "mousedown",
      "mouseup",
      "dblclick",
      "auxclick",
      "focusin",
      "submit",
      "dragstart",
    ]

    window.addEventListener("mousemove", onMove, true)
    window.addEventListener("click", onClick, true)
    window.addEventListener("contextmenu", onContextMenu, true)
    window.addEventListener("keydown", onKey, true)
    for (const type of SWALLOW) window.addEventListener(type, swallow, true)
    applyHostCursor()
    return () => {
      window.removeEventListener("mousemove", onMove, true)
      window.removeEventListener("click", onClick, true)
      window.removeEventListener("contextmenu", onContextMenu, true)
      window.removeEventListener("keydown", onKey, true)
      for (const type of SWALLOW) window.removeEventListener(type, swallow, true)
      clearHostCursor()
    }
  }, [phase, host, cancel, mustMatch])

  // Reflect "this spot can't be picked" as a not-allowed cursor on the host page.
  useEffect(() => {
    setHostCursorBlocked(phase === "hover" && blocked)
  }, [phase, blocked])

  // Esc also cancels from the locked phase.
  useEffect(() => {
    if (phase !== "locked") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [phase, cancel])

  // Regenerate the selector when the locked element or settings change
  // (unless the user has manually edited the selector field).
  useEffect(() => {
    if (phase !== "locked" || !locked || selectorEdited) return
    setSelector(generateSelector(locked, settings))
  }, [phase, locked, settings, selectorEdited])

  // Live preview selector under the cursor during hover.
  const preview = useMemo(() => {
    if (phase !== "hover" || !hovered) return null
    return generateSelector(hovered, settings)
  }, [phase, hovered, settings])

  const attributes = useMemo(() => (locked ? collectAttributes(locked) : []), [locked])
  // The selector shown in the sidebar: live preview while hovering, the (editable)
  // selector once locked. Match count tracks whatever is shown.
  const shownSelector = locked ? selector : (preview ?? "")
  const selectorEval = useMemo(() => evalSelector(shownSelector), [shownSelector])

  const retarget = useCallback((next: Element | null) => {
    if (!next) return
    setLocked(next)
    setSelectorEdited(false)
  }, [])

  // Return to hover mode to pick a different element (clears the current selection).
  // Also leaves navigate mode (used as "Resume picking").
  const reselect = useCallback(() => {
    setNavigateMode(false)
    setLocked(null)
    setHovered(null)
    setSelector("")
    setSelectorEdited(false)
    setBlocked(false)
    setPhase("hover")
  }, [])

  // Suspend the pick so the page is interactive; persist it so navigation stays in
  // navigate mode (the user may hop through several pages) until they resume.
  const enterNavigate = useCallback(() => {
    setNavigateMode(true)
    setPhase("navigate")
  }, [])

  // Manual selector edit: keep the typed value (turn off auto-regeneration) and
  // re-lock to the first element it matches, so the highlight, tree, attributes,
  // and screenshot follow what the selector targets. If it matches nothing or is
  // invalid, keep the current selection (don't flicker to nothing mid-typing).
  const editSelector = useCallback(
    (value: string) => {
      setSelector(value)
      setSelectorEdited(true)
      try {
        const match = value.trim() ? document.querySelector(value) : null
        if (match && match !== host) setLocked(match)
      } catch {
        // invalid selector — leave the current selection as-is
      }
    },
    [host],
  )

  const confirm = useCallback(async () => {
    if (!locked) return onResolve({ type: "cancelled" })

    // Toolbar pick: no caller to receive the result — hand the selector to the user
    // via the clipboard, flash "Copied", then close. Write before any await so the
    // clipboard call stays inside the click's user activation.
    if (copyOnConfirm) {
      try {
        await navigator.clipboard.writeText(selector)
      } catch {
        // Clipboard blocked (rare) — still close so the picker doesn't get stuck.
      }
      setCopied(true)
      window.setTimeout(() => {
        onResolve({
          type: "result",
          result: {
            selector,
            matchCount: countMatches(selector),
            element: describeElement(locked),
          },
        })
      }, 900)
      return
    }

    const screenshot = await captureScreenshot(
      normalizeScreenshotMode(params.screenshot),
      locked,
      host,
    )
    const result: PickResult = {
      selector,
      matchCount: countMatches(selector),
      element: describeElement(locked),
      screenshot,
    }
    onResolve({ type: "result", result })
  }, [locked, selector, copyOnConfirm, params.screenshot, onResolve, host])

  // The locked element fell outside `mustMatch` (e.g. after tree navigation) — block
  // confirming it, the same way requireUniqueMatch blocks a non-unique selector.
  const targetMismatch = !!locked && !matchesTarget(locked, mustMatch)

  // Selector-rule conformance (strict): with rules active, the selector must conform —
  // an empty one (no conforming selector for this element) or a violating one (e.g.
  // hand-edited) shows a warning and blocks confirming.
  const rulesActive = hasSelectorRules(settings)
  const trimmedSelector = shownSelector.trim()
  const ruleEmpty = !!locked && rulesActive && !trimmedSelector
  const ruleMismatch =
    !!locked && rulesActive && !!trimmedSelector && !conformsToSettings(shownSelector, settings)

  // hover + locked share one persistent Sidebar; page overlays reflect the
  // current target (hovered while finding, locked once selected).
  const overlayEl = locked ?? hovered
  const overlayRect = locked ? lockedRect : hoverRect
  const tree = {
    parentLabel: locked && getParent(locked) ? tagLabel(getParent(locked) as Element) : null,
    prevLabel:
      locked && getPrevSibling(locked, host)
        ? tagLabel(getPrevSibling(locked, host) as Element)
        : null,
    currentLabel: locked ? tagLabel(locked) : "",
    nextLabel:
      locked && getNextSibling(locked, host)
        ? tagLabel(getNextSibling(locked, host) as Element)
        : null,
    childLabel:
      locked && getFirstChild(locked, host)
        ? tagLabel(getFirstChild(locked, host) as Element)
        : null,
    onParent: () => locked && retarget(getParent(locked)),
    onPrev: () => locked && retarget(getPrevSibling(locked, host)),
    onNext: () => locked && retarget(getNextSibling(locked, host)),
    onChild: () => locked && retarget(getFirstChild(locked, host)),
    onCenter: () =>
      locked?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }),
  }

  return (
    <>
      {overlayEl && overlayRect && (
        <HighlightBox rect={overlayRect} el={overlayEl} glideMs={locked ? 180 : 120} />
      )}
      {overlayEl && overlayRect && <RulerGuides rect={overlayRect} />}
      {/* Tag preview while hovering; once locked, the sidebar carries the details. */}
      {!locked && hovered && hoverRect && <TagTooltip el={hovered} rect={hoverRect} />}
      <Sidebar
        phase={phase === "navigate" ? "navigate" : locked ? "locked" : "hover"}
        selector={shownSelector}
        matchCount={selectorEval.count}
        selectorValid={selectorEval.valid}
        attributes={attributes}
        settings={settings}
        side={side}
        tree={tree}
        onSelectorChange={editSelector}
        onSettingsChange={(patch) =>
          setSettings((s) => {
            const next = { ...s, ...patch }
            // Write back only for toolbar picks (the user's own context); SDK picks
            // are session-only so a site can't mutate the user's saved preferences.
            if (copyOnConfirm) saveSelectorSettings(window.origin, next)
            return next
          })
        }
        onSwapSide={() => setSide((s) => (s === "right" ? "left" : "right"))}
        onReselect={reselect}
        canNavigate={!!canNavigate}
        onNavigate={enterNavigate}
        onResume={reselect}
        onConfirm={confirm}
        onCancel={cancel}
        confirmLabel={copyOnConfirm ? i18n.t("picker.copy") : i18n.t("picker.ok")}
        confirmDone={copied}
        lockSelectorSettings={!!params.lockSelectorSettings}
        lockSelectorEdit={!!params.lockSelectorEdit}
        requireUniqueMatch={!!params.requireUniqueMatch}
        blocked={blocked}
        targetMismatch={targetMismatch}
        ruleMismatch={ruleMismatch}
        ruleEmpty={ruleEmpty}
      />
    </>
  )
}
