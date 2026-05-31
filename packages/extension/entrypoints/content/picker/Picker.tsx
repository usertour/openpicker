import type { PickParams, PickResult } from "@openpicker/protocol"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BottomBar } from "./BottomBar"
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
import { getConsent, requestScreenshot, setConsent } from "./messaging"
import { RulerGuides } from "./RulerGuides"
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
  onResolve: (outcome: PickOutcome) => void
}

export function Picker({ params, host, onResolve }: PickerProps) {
  const [phase, setPhase] = useState<Phase>("consent")
  const [hovered, setHovered] = useState<Element | null>(null)
  const [locked, setLocked] = useState<Element | null>(null)
  const [pinTop, setPinTop] = useState(false)
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

  // Decide whether to show the consent prompt on mount.
  useEffect(() => {
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
  }, [onResolve])

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
    const onPointerDown = (e: PointerEvent) => {
      if (insideUs(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.button === 2) {
        cancel()
        return
      }
      if (e.target instanceof Element) {
        setLocked(e.target)
        setSelectorEdited(false)
        setPhase("locked")
      }
    }
    const swallow = (e: Event) => {
      if (insideUs(e.target)) return
      e.preventDefault()
      e.stopPropagation()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        cancel()
      }
    }

    window.addEventListener("mousemove", onMove, true)
    window.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("click", swallow, true)
    window.addEventListener("contextmenu", swallow, true)
    window.addEventListener("keydown", onKey, true)
    document.body.classList.add("openpicker-active")
    return () => {
      window.removeEventListener("mousemove", onMove, true)
      window.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("click", swallow, true)
      window.removeEventListener("contextmenu", swallow, true)
      window.removeEventListener("keydown", onKey, true)
      document.body.classList.remove("openpicker-active")
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
  const matchCount = useMemo(() => countMatches(selector), [selector])

  const retarget = useCallback((next: Element | null) => {
    if (!next) return
    setLocked(next)
    setSelectorEdited(false)
    setChecked(new Set())
  }, [])

  const confirm = useCallback(async () => {
    if (!locked) return onResolve({ type: "cancelled" })
    const criteria: Record<string, string> = {}
    const all = collectAttributes(locked)
    for (const entry of all) {
      if (checked.has(entry.name)) criteria[entry.name] = entry.value
    }
    let screenshot: string | undefined
    if (params.screenshot) {
      screenshot = (await requestScreenshot()) ?? undefined
    }
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

  if (phase === "hover") {
    return (
      <>
        {hovered && hoverRect && <HighlightBox rect={hoverRect} />}
        {hovered && hoverRect && <RulerGuides rect={hoverRect} />}
        {hovered && hoverRect && <TagTooltip el={hovered} rect={hoverRect} />}
        <BottomBar
          preview={preview}
          pinTop={pinTop}
          onTogglePin={() => setPinTop((v) => !v)}
          onCancel={cancel}
        />
      </>
    )
  }

  // locked
  return (
    <>
      {locked && lockedRect && <HighlightBox rect={lockedRect} animated />}
      {locked && (
        <Sidebar
          selector={selector}
          matchCount={matchCount}
          attributes={attributes}
          checkedCriteria={checked}
          settings={settings}
          side={side}
          tree={{
            parentLabel: getParent(locked) ? tagLabel(getParent(locked) as Element) : null,
            prevLabel: getPrevSibling(locked, host)
              ? tagLabel(getPrevSibling(locked, host) as Element)
              : null,
            currentLabel: tagLabel(locked),
            nextLabel: getNextSibling(locked, host)
              ? tagLabel(getNextSibling(locked, host) as Element)
              : null,
            childLabel: getFirstChild(locked, host)
              ? tagLabel(getFirstChild(locked, host) as Element)
              : null,
            onParent: () => retarget(getParent(locked)),
            onPrev: () => retarget(getPrevSibling(locked, host)),
            onNext: () => retarget(getNextSibling(locked, host)),
            onChild: () => retarget(getFirstChild(locked, host)),
          }}
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
          onConfirm={confirm}
          onCancel={cancel}
        />
      )}
    </>
  )
}
