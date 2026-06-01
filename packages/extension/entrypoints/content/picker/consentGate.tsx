import ReactDOM from "react-dom/client"
import { ConsentPrompt } from "./ConsentPrompt"
import { getConsent, setConsent } from "./messaging"
import { mountShadow } from "./mount"

/**
 * Resolve per-origin consent in the current (source) tab, showing the prompt only
 * when the decision hasn't been made yet. Used before a cross-tab pick so consent
 * is bound to the source origin — the target tab then skips its own prompt.
 *
 * Returns true if granted, false if denied.
 */
export async function ensureConsent(appName?: string): Promise<boolean> {
  const status = await getConsent()
  if (status === "granted") return true
  if (status === "denied") return false

  const mount = await mountShadow()
  const root = ReactDOM.createRoot(mount.container)
  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (granted: boolean) => {
      if (settled) return
      settled = true
      root.unmount()
      mount.remove()
      resolve(granted)
    }
    root.render(
      <ConsentPrompt
        origin={window.origin}
        appName={appName}
        onAllow={() => {
          setConsent(true)
          finish(true)
        }}
        onDeny={() => {
          setConsent(false)
          finish(false)
        }}
      />,
    )
  })
}
