import type { PickParams, PickResult } from "@openpicker/protocol"
import ReactDOM from "react-dom/client"
import { mountShadow } from "./mount"
import { Picker } from "./Picker"

/** Outcome of a pick: a confirmed result, a user cancel, or a consent denial. */
export type PickOutcome =
  | { type: "result"; result: PickResult }
  | { type: "cancelled" }
  | { type: "denied" }

let active = false
let cancelActive: (() => void) | null = null

/** Abort an in-flight pick (resolves it as cancelled). Used by the `cancel` method. */
export function cancelActivePicker(): void {
  cancelActive?.()
}

/**
 * Mount the picker into an isolated Shadow DOM and resolve when the user confirms
 * (PickResult) or cancels/denies. Only one picker runs at a time.
 *
 * `skipConsent` is used in the cross-tab target tab, where consent was already
 * resolved against the source origin before the tab was opened.
 */
export async function runPicker(
  params: PickParams,
  options: { skipConsent?: boolean } = {},
): Promise<PickOutcome> {
  if (active) return { type: "cancelled" }
  active = true

  const mount = await mountShadow()
  const root = ReactDOM.createRoot(mount.container)

  return new Promise<PickOutcome>((resolve) => {
    let settled = false
    const finish = (outcome: PickOutcome) => {
      if (settled) return
      settled = true
      active = false
      cancelActive = null
      root.unmount()
      mount.remove()
      resolve(outcome)
    }
    cancelActive = () => finish({ type: "cancelled" })
    root.render(
      <Picker
        params={params}
        host={mount.host}
        skipConsent={options.skipConsent}
        onResolve={finish}
      />,
    )
  })
}
