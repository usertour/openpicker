import type { PickParams, PickResult } from "@openpicker/protocol"
import ReactDOM from "react-dom/client"
import { mountShadow } from "./mount"
import { Picker } from "./Picker"
import { defaultSelectorSettings } from "./SettingsPopover"
import { loadSelectorSettings } from "./settingsStore"

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
 * (PickResult) or cancels. Only one picker runs at a time. `canNavigate` offers the
 * "navigate to another page" control — only safe in the cross-tab target tab, where
 * the pick resumes after navigation and the result is routed back via the background.
 */
export async function runPicker(
  params: Partial<PickParams> = {},
  options: { canNavigate?: boolean } = {},
): Promise<PickOutcome> {
  if (active) return { type: "cancelled" }
  active = true

  // Per-origin selector settings (a site's conventions are remembered). The SDK's
  // `exclude` takes priority over the saved ignore patterns when the caller passes it.
  const saved = (await loadSelectorSettings(window.origin)) ?? defaultSelectorSettings()
  const initialSettings = params.exclude
    ? { ...saved, ignoreId: params.exclude, ignoreClass: params.exclude }
    : saved

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
        canNavigate={options.canNavigate}
        initialSettings={initialSettings}
        onResolve={finish}
      />,
    )
  })
}
