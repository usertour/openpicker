import type { PickParams } from "@openpicker/protocol"
import { setNavigateMode } from "./navigateMode"
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
  /** Correlates the result with the source's awaiting pick. */
  pickId?: string
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
async function runAndReport(
  sourceTabId: number,
  params: Partial<PickParams>,
  pickId: string | undefined,
): Promise<void> {
  if (running) return
  running = true
  writeMarker({ sourceTabId, params, pickId })
  try {
    const outcome = await runPicker(params, { canNavigate: true })
    clearMarker()
    // The pick is over (confirmed/cancelled); don't let a reused pick on this tab
    // start in navigate mode. (Navigation abandons runPicker, so this isn't reached
    // then and the flag persists to resume in navigate mode — which is the point.)
    setNavigateMode(false)
    await browser.runtime.sendMessage({ kind: "crossTab:result", sourceTabId, outcome, pickId })
  } finally {
    running = false
  }
}

/** Called when the background tells this tab (freshly) to run a cross-tab pick. */
export function startCrossTabTarget(
  sourceTabId: number,
  params: Partial<PickParams>,
  pickId: string | undefined,
): void {
  void runAndReport(sourceTabId, params, pickId)
}

/**
 * On content-script load, resume a cross-tab pick if this tab is an active target.
 * Asks the background, which is the source of truth: its source↔target map lives in
 * storage.session, so it still knows about the pick even after the service worker
 * was recycled. (The marker only gates the lookup to same-origin navigation, which
 * is the supported continuity case; cross-origin is out of scope — DESIGN.md §5d.)
 */
export async function resumeCrossTabTargetOnLoad(): Promise<void> {
  const marker = readMarker()
  if (!marker) return
  try {
    const res = (await browser.runtime.sendMessage({ kind: "crossTab:hello" })) as
      | { run?: boolean; sourceTabId?: number; params?: Partial<PickParams>; pickId?: string }
      | undefined
    if (res?.run && res.sourceTabId !== undefined) {
      void runAndReport(res.sourceTabId, res.params ?? marker.params, res.pickId ?? marker.pickId)
    } else {
      clearMarker() // the pick is no longer wanted here (the map has no entry)
    }
  } catch {
    // Background unreachable; leave the marker for a later attempt.
  }
}
