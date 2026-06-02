import type { PickParams } from "@openpicker/protocol"
import { runPicker } from "./run"

/**
 * Target-tab side of cross-tab picking (DESIGN.md §5d phase 2).
 *
 * A sessionStorage marker records "a pick is active in this tab" plus the params.
 * It persists across same-tab navigation and is inherited by same-origin new tabs
 * (window.open / target=_blank), so the picker can resume automatically. Results
 * are pushed to the background (which routes them to the source tab via the map),
 * so delivery survives navigation — unlike a one-shot sendMessage response.
 */

const MARKER_KEY = "openpicker:crossTabPick"

interface Marker {
  sourceTabId: number
  params: Partial<PickParams>
}

function readMarker(): Marker | null {
  try {
    const raw = window.sessionStorage.getItem(MARKER_KEY)
    return raw ? (JSON.parse(raw) as Marker) : null
  } catch {
    return null
  }
}

function writeMarker(marker: Marker): void {
  try {
    window.sessionStorage.setItem(MARKER_KEY, JSON.stringify(marker))
  } catch {
    // sessionStorage unavailable (rare); continuity just won't survive navigation.
  }
}

function clearMarker(): void {
  try {
    window.sessionStorage.removeItem(MARKER_KEY)
  } catch {
    // ignore
  }
}

let running = false

/** Run the picker as a cross-tab target and push the outcome to the background. */
async function runAndReport(sourceTabId: number, params: Partial<PickParams>): Promise<void> {
  if (running) return
  running = true
  writeMarker({ sourceTabId, params })
  try {
    const outcome = await runPicker(params, { skipConsent: true })
    clearMarker()
    await browser.runtime.sendMessage({ kind: "crossTab:result", sourceTabId, outcome })
  } finally {
    running = false
  }
}

/** Called when the background tells this tab (freshly) to run a cross-tab pick. */
export function startCrossTabTarget(sourceTabId: number, params: Partial<PickParams>): void {
  void runAndReport(sourceTabId, params)
}

/**
 * On content-script load, resume a cross-tab pick if this tab is (or inherited) an
 * active target. Asks the background whether a pick is still pending for it; the
 * background is the source of truth (the sessionStorage marker alone can't tell if
 * the source already gave up).
 */
export async function resumeCrossTabTargetOnLoad(): Promise<void> {
  const marker = readMarker()
  if (!marker) return
  try {
    const res = (await browser.runtime.sendMessage({ kind: "crossTab:hello" })) as
      | { run?: boolean; sourceTabId?: number; params?: Partial<PickParams> }
      | undefined
    if (res?.run && res.sourceTabId !== undefined) {
      void runAndReport(res.sourceTabId, res.params ?? marker.params)
    } else {
      clearMarker() // the pick is no longer wanted here
    }
  } catch {
    // Background unreachable; leave the marker for a later attempt.
  }
}
