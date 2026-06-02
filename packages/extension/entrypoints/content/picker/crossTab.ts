import type { PickParams } from "@openpicker/protocol"
import type { PickOutcome } from "./run"

/**
 * Source-tab side of a cross-tab pick (DESIGN.md §5c). Asks the background to open
 * the URL and run the picker in a target tab, then waits for the result to arrive
 * as a one-shot `crossTab:deliver` message, routed back through the background's
 * storage-backed source↔target map.
 *
 * There is no long-lived port and no in-memory state in the background, so the pick
 * survives the MV3 service worker being recycled mid-pick (the old port-based design
 * lost the pick when the worker died). Mirrors the proven cross-tab pattern.
 */

const pending = new Map<string, (outcome: PickOutcome) => void>()
let listening = false

function ensureListener(): void {
  if (listening) return
  listening = true
  browser.runtime.onMessage.addListener((message: unknown) => {
    const m = message as { kind?: string; pickId?: string; outcome?: PickOutcome }
    if (m?.kind !== "crossTab:deliver" || !m.pickId) return
    const resolve = pending.get(m.pickId)
    if (resolve) {
      pending.delete(m.pickId)
      resolve(m.outcome ?? { type: "cancelled" })
    }
  })
}

/** A per-pick id correlating the eventual delivery with this call. */
function newPickId(): string {
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function runCrossTabPick(params: PickParams): Promise<PickOutcome> {
  ensureListener()
  const pickId = newPickId()
  return new Promise<PickOutcome>((resolve) => {
    let settled = false
    const done = (outcome: PickOutcome) => {
      if (settled) return
      settled = true
      pending.delete(pickId)
      resolve(outcome)
    }
    pending.set(pickId, done)
    browser.runtime
      .sendMessage({ kind: "crossTab:open", url: params.url, params, pickId })
      .then((res) => {
        // The background couldn't start the pick (e.g. the tab failed to open).
        if (!(res as { ok?: boolean } | undefined)?.ok) done({ type: "cancelled" })
      })
      .catch(() => done({ type: "cancelled" })) // background unreachable
  })
}
