import type { PickParams, PickResult } from "@openpicker/protocol"
import ReactDOM from "react-dom/client"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root"
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
 * (PickResult) or cancels (null). Only one picker runs at a time.
 *
 * Lives in its own module so the heavy React + Tailwind + finder code can be
 * dynamically imported by the content-script connector only when a pick starts.
 */
export async function runPicker(
  ctx: ContentScriptContext,
  params: PickParams,
): Promise<PickOutcome> {
  if (active) return { type: "cancelled" }
  active = true

  return new Promise<PickOutcome>((resolve) => {
    let settled = false
    let root: ReactDOM.Root | undefined
    let ui: { remove: () => void } | undefined

    const finish = (outcome: PickOutcome) => {
      if (settled) return
      settled = true
      active = false
      cancelActive = null
      ui?.remove()
      resolve(outcome)
    }
    cancelActive = () => finish({ type: "cancelled" })

    console.log("[openpicker] runPicker: creating shadow UI")
    createShadowRootUi(ctx, {
      name: "openpicker-ui",
      position: "overlay",
      anchor: "body",
      onMount(container, _shadow, shadowHost) {
        console.log("[openpicker] runPicker: onMount")
        root = ReactDOM.createRoot(container)
        root.render(<Picker params={params} host={shadowHost} onResolve={finish} />)
        return root
      },
      onRemove(mounted) {
        mounted?.unmount()
      },
    })
      .then((created) => {
        console.log("[openpicker] runPicker: mounting")
        ui = created
        created.mount()
      })
      .catch((err) => {
        console.log("[openpicker] runPicker: FAILED", String(err))
        finish({ type: "cancelled" })
      })
  })
}
