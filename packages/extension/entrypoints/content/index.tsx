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
import { clearHighlight, runHighlight } from "./picker/highlight"
import { cancelActivePicker, runPicker } from "./picker/run"
import "./style.css"

/** The union of every method's result shape — what may travel on a response. */
type AnyResult = MethodMap[MethodName]["result"]

/**
 * Content-script connector: the public end of the protocol (PROTOCOL.md §2).
 *
 * The picker UI (React + Tailwind + finder) lives in ./picker/* and is bundled
 * into this content script (WXT emits content scripts as a single file).
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  main() {
    const manifest = browser.runtime.getManifest()
    const capabilities = [
      "ping",
      "pick",
      "cancel",
      "highlight",
      "clearHighlight",
      "listMode",
      "exclude",
    ]

    function send(payload: ResponseEnvelope): void {
      window.postMessage(payload, window.origin)
    }
    function replyOk(id: string, result: AnyResult): void {
      send({ channel: CHANNEL, v: PROTOCOL_VERSION, kind: "res", id, ok: true, result })
    }
    function replyErr(id: string, error: ProtocolError): void {
      send({ channel: CHANNEL, v: PROTOCOL_VERSION, kind: "res", id, ok: false, error })
    }

    async function handlePick(req: RequestEnvelope<"pick">): Promise<void> {
      const outcome = await runPicker(req.params)
      if (outcome.type === "result") {
        replyOk(req.id, outcome.result)
      } else if (outcome.type === "denied") {
        replyErr(req.id, { code: "consent_denied", message: "openpicker: the user denied this origin" })
      } else {
        replyErr(req.id, { code: "cancelled", message: "openpicker: the user cancelled the picker" })
      }
    }

    async function handle(req: RequestEnvelope): Promise<void> {
      switch (req.method) {
        case "ping":
          replyOk(req.id, {
            extensionVersion: manifest.version,
            protocolVersions: [PROTOCOL_VERSION],
            capabilities,
          })
          return
        case "pick":
          await handlePick(req as RequestEnvelope<"pick">)
          return
        case "cancel":
          cancelActivePicker()
          replyOk(req.id, {})
          return
        case "highlight":
          replyOk(req.id, {
            matchCount: runHighlight((req as RequestEnvelope<"highlight">).params.selector),
          })
          return
        case "clearHighlight":
          clearHighlight()
          replyOk(req.id, {})
          return
        default:
          replyErr(req.id, {
            code: "unsupported",
            message: `openpicker: method "${(req as RequestEnvelope).method}" is not supported`,
          })
      }
    }

    window.addEventListener("message", (event) => {
      // Only accept messages from this same window and origin (PROTOCOL.md §2).
      if (event.source !== window) return
      if (event.origin !== window.origin) return
      const data = event.data
      if (!isEnvelope(data) || data.kind !== "req") return
      void handle(data as RequestEnvelope)
    })

    // Toolbar icon → start a pick, so the picker can be exercised without the SDK.
    browser.runtime.onMessage.addListener((message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { kind?: string }).kind === "startPick"
      ) {
        void runPicker({})
      }
    })
  },
})
