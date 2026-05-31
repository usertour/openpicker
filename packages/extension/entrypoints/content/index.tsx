import {
  CHANNEL,
  isEnvelope,
  type MethodMap,
  type MethodName,
  PROTOCOL_VERSION,
  type ProtocolError,
  type RequestEnvelope,
  type ResponseEnvelope,
} from "@openpicker/protocol"
import ReactDOM from "react-dom/client"
import { Overlay } from "./Overlay"
import { setOverlayState, toggleActive } from "./store"
import "./style.css"

/** The union of every method's result shape — what may travel on a response. */
type AnyResult = MethodMap[MethodName]["result"]

/**
 * Content script: the public end of the protocol (PROTOCOL.md §2) plus the host for
 * the picker UI, rendered into an isolated Shadow DOM via WXT's createShadowRootUi
 * with `cssInjectionMode: 'ui'` so Tailwind styles are scoped to the shadow root.
 *
 * v1 skeleton implements `ping` fully; other methods reply `unsupported` until the
 * picker and consent flow land. The toolbar icon toggles a demo overlay to verify
 * the Shadow DOM + Tailwind foundation.
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const manifest = browser.runtime.getManifest()

    function reply(
      id: string,
      payload: { result: AnyResult } | { error: ProtocolError },
    ): void {
      const res: ResponseEnvelope = {
        channel: CHANNEL,
        v: PROTOCOL_VERSION,
        kind: "res",
        id,
        ok: "result" in payload,
        ...payload,
      }
      window.postMessage(res, window.origin)
    }

    // Public protocol: page SDK → content script over window.postMessage.
    window.addEventListener("message", (event) => {
      // Only accept messages from this same window and origin (PROTOCOL.md §2).
      if (event.source !== window) return
      if (event.origin !== window.origin) return
      const data = event.data
      if (!isEnvelope(data) || data.kind !== "req") return
      const req = data as RequestEnvelope

      switch (req.method) {
        case "ping":
          reply(req.id, {
            result: {
              extensionVersion: manifest.version,
              protocolVersions: [PROTOCOL_VERSION],
              capabilities: ["ping"],
            },
          })
          break
        default:
          reply(req.id, {
            error: {
              code: "unsupported",
              message: `openpicker: method "${req.method}" is not implemented yet`,
            },
          })
      }
    })

    // Extension-internal: background relays the toolbar icon click here.
    browser.runtime.onMessage.addListener((message: unknown) => {
      if (typeof message === "object" && message !== null && (message as { kind?: string }).kind === "toggleOverlay") {
        toggleActive()
      }
    })

    // Mount the React overlay into an isolated Shadow DOM.
    const ui = await createShadowRootUi(ctx, {
      name: "openpicker-ui",
      position: "overlay",
      anchor: "body",
      onMount(container) {
        const root = ReactDOM.createRoot(container)
        root.render(<Overlay />)
        return root
      },
      onRemove(root) {
        root?.unmount()
        setOverlayState({ active: false })
      },
    })
    ui.mount()
  },
})
