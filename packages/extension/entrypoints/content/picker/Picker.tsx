import type { PickParams, PickResult } from "@openpicker/protocol"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ConsentPrompt } from "./ConsentPrompt"
import {
  collectAttributes,
  describeElement,
  getFirstChild,
  getNextSibling,
  getParent,
  getPrevSibling,
  tagLabel,
} from "./dom"
import { HighlightBox } from "./HighlightBox"
import { applyHostCursor, clearHostCursor } from "./hostCursor"
import { getConsent, setConsent } from "./messaging"
import { RulerGuides } from "./RulerGuides"
import { captureScreenshot, normalizeScreenshotMode } from "./screenshot"
import { generateSelector, matchCount as countMatches } from "./selector"
import type { SelectorSettings } from "./SettingsPopover"
import { Sidebar } from "./Sidebar"
import { TagTooltip } from "./TagTooltip"
import { useTrackedRect } from "./useTrackedRect"

import type { PickOutcome } from "./run"

type Phase = "consent" | "hover" | "locked"

interface PickerProps {
  params: PickParams
  /** Our shadow host element, excluded from targeting. */
  host: Element
  /**
   * Skip the consent prompt and go straight to hovering. Used in the cross-tab
   * target tab, where consent was already resolved in the source tab.
   */
  skipConsent?: boolean
  onResolve: (outcome: PickOutcome) => void
}

export function Picker({ params, host, skipConsent, onResolve }: PickerProps) {
  const [phase, setPhase] = useState<Phase>(skipConsent ? "hover" : "consent")
  const [hovered, setHovered] = useState<Element | null>(null)
  const [locked, setLocked] = useState<Element | null>(null)
  const [side, setSide] = useState<"left" | "right">("right")
  const [settings, setSettings] = useState<SelectorSettings>({
    mode: params.mode ?? "unique",
    exclude: params.exclude ?? "",
    iframe: params.iframe ?? false,
  })
  const [selector, setSelector] = useState("")
  const [selectorEdited, setSelectorEdited] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const hoverRect = useTrackedRect(phase === "hover" ? hovered : null)
  const lockedRect = useTrackedRect(phase === "locked" ? locked : null)

  // Decide whether to show the consent prompt on mount (unless already resolved
  // upstream, e.g. in the cross-tab source tab).
  useEffect(() => {
    if (skipConsent) return
    let cancelled = false
    getConsent().then((status) => {
      if (cancelled) return
      if (status === "granted") setPhase("hover")
      else if (status === "denied") onResolve({ type: "denied" })
      else setPhase("consent")
    })
    return () => {
      cancelled = true
    }
  }, [onResolve, skipConsent])

  const cancel = useCallback(() => onResolve({ type: "cancelled" }), [onResolve])

  // Capture-phase page listeners during the hover phase. See DESIGN.md §5.1.
  useEffect(() => {
    if (phase !== "hover") return

    const insideUs = (t: EventTarget | null) =>
      t instanceof Node && (t === host || host.contains(t))

    const onMove = (e: MouseEvent) => {
      const t = e.target
      if (insideUs(t)) return
      if (t instanceof Element) setHovered(t)
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
        setLocked(e.target)
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
    const SWALLOW = ["mousedown", "mouseup", "dblclick", "auxclick", "focusin", "submit", "dragstart"]

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
  }, [phase, host, cancel])

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
    setSelector(generateSelector(locked, { mode: settings.mode, exclude: settings.exclude }))
  }, [phase, locked, settings.mode, settings.exclude, selectorEdited])

  // Live preview selector under the cursor during hover.
  const preview = useMemo(() => {
    if (phase !== "hover" || !hovered) return null
    return generateSelector(hovered, { mode: settings.mode, exclude: settings.exclude })
  }, [phase, hovered, settings.mode, settings.exclude])

  const attributes = useMemo(() => (locked ? collectAttributes(locked) : []), [locked])
  // The selector shown in the sidebar: live preview while hovering, the (editable)
  // selector once locked. Match count tracks whatever is shown.
  const shownSelector = locked ? selector : (preview ?? "")
  const matchCount = useMemo(() => countMatches(shownSelector), [shownSelector])

  const retarget = useCallback((next: Element | null) => {
    if (!next) return
    setLocked(next)
    setSelectorEdited(false)
    setChecked(new Set())
  }, [])

  // Return to hover mode to pick a different element (clears the current selection).
  const reselect = useCallback(() => {
    setLocked(null)
    setHovered(null)
    setSelector("")
    setSelectorEdited(false)
    setChecked(new Set())
    setPhase("hover")
  }, [])

  const confirm = useCallback(async () => {
    if (!locked) return onResolve({ type: "cancelled" })
    const criteria: Record<string, string> = {}
    const all = collectAttributes(locked)
    for (const entry of all) {
      if (checked.has(entry.name)) criteria[entry.name] = entry.value
    }
    const screenshot = await captureScreenshot(normalizeScreenshotMode(params.screenshot), locked)
    const result: PickResult = {
      selector,
      matchCount: countMatches(selector),
      element: describeElement(locked),
      criteria: Object.keys(criteria).length ? criteria : undefined,
      screenshot,
    }
    onResolve({ type: "result", result })
  }, [locked, checked, selector, params.screenshot, onResolve])

  if (phase === "consent") {
    return (
      <ConsentPrompt
        origin={window.origin}
        appName={params.appName}
        onAllow={() => {
          setConsent(true)
          setPhase("hover")
        }}
        onDeny={() => {
          setConsent(false)
          onResolve({ type: "denied" })
        }}
      />
    )
  }

  // hover + locked share one persistent Sidebar; page overlays reflect the
  // current target (hovered while finding, locked once selected).
  const overlayEl = locked ?? hovered
  const overlayRect = locked ? lockedRect : hoverRect
  const tree = {
    parentLabel: locked && getParent(locked) ? tagLabel(getParent(locked) as Element) : null,
    prevLabel:
      locked && getPrevSibling(locked, host) ? tagLabel(getPrevSibling(locked, host) as Element) : null,
    currentLabel: locked ? tagLabel(locked) : "",
    nextLabel:
      locked && getNextSibling(locked, host) ? tagLabel(getNextSibling(locked, host) as Element) : null,
    childLabel:
      locked && getFirstChild(locked, host) ? tagLabel(getFirstChild(locked, host) as Element) : null,
    onParent: () => locked && retarget(getParent(locked)),
    onPrev: () => locked && retarget(getPrevSibling(locked, host)),
    onNext: () => locked && retarget(getNextSibling(locked, host)),
    onChild: () => locked && retarget(getFirstChild(locked, host)),
  }

  return (
    <>
      {overlayEl && overlayRect && (
        <HighlightBox rect={overlayRect} el={overlayEl} glideMs={locked ? 180 : 120} />
      )}
      {overlayEl && overlayRect && <RulerGuides rect={overlayRect} />}
      {overlayEl && overlayRect && <TagTooltip el={overlayEl} rect={overlayRect} />}
      <Sidebar
        phase={locked ? "locked" : "hover"}
        selector={shownSelector}
        matchCount={matchCount}
        attributes={attributes}
        checkedCriteria={checked}
        settings={settings}
        side={side}
        tree={tree}
        onSelectorChange={(v) => {
          setSelector(v)
          setSelectorEdited(true)
        }}
        onToggleCriterion={(name) =>
          setChecked((prev) => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
          })
        }
        onSettingsChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        onSwapSide={() => setSide((s) => (s === "right" ? "left" : "right"))}
        onReselect={reselect}
        onConfirm={confirm}
        onCancel={cancel}
      />
    </>
  )
}
