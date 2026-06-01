import type { PickParams } from "@openpicker/protocol"
import type { PickOutcome } from "./run"

/**
 * Source-tab side of a cross-tab pick (DESIGN.md §5c). Opens a long-lived port to
 * the background (which keeps the MV3 service worker alive for the whole pick),
 * asks it to open the URL and run the picker there, and resolves with the outcome
 * routed back. Consent must already be resolved for the source origin.
 */
export function runCrossTabPick(params: PickParams): Promise<PickOutcome> {
  return new Promise<PickOutcome>((resolve) => {
    let settled = false
    const done = (outcome: PickOutcome) => {
      if (settled) return
      settled = true
      resolve(outcome)
    }

    const port = browser.runtime.connect({ name: "openpicker:crossTab" })
    port.onMessage.addListener((msg: unknown) => {
      const m = msg as { kind?: string; outcome?: PickOutcome }
      if (m?.kind === "crossTab:outcome" && m.outcome) {
        done(m.outcome)
        port.disconnect()
      }
    })
    // If the background goes away (or the source tab is torn down) treat as cancel.
    port.onDisconnect.addListener(() => done({ type: "cancelled" }))
    port.postMessage({ kind: "crossTab:open", url: params.url, params })
  })
}
