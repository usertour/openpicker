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
import { ensureConsent } from "./picker/consentGate"
import { runCrossTabPick } from "./picker/crossTab"
import { resumeCrossTabTargetOnLoad, startCrossTabTarget } from "./picker/crossTabTarget"
import { clearHighlight, runHighlight } from "./picker/highlight"
import { getAuthMode, getConsent } from "./picker/messaging"
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
      "screenshot",
      "openUrl",
      "activateSelf",
      "isTargetOpen",
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
      // pick is cross-tab only: the extension opens `url` in a tab and picks there,
      // routing the result back. A page can already script its own DOM, so same-tab
      // picking is not an SDK capability (only the toolbar offers it, for humans).
      if (!req.params.url) {
        replyErr(req.id, {
          code: "invalid_params",
          message: "openpicker: pick requires a `url` to open and pick in",
        })
        return
      }

      // Authorize the calling (source) origin per the configured mode (DESIGN.md §6).
      // The real safeguard is the user picking + confirming; this only gates which
      // sites may drive the picker at all.
      const mode = await getAuthMode()
      let denied = false
      if (mode === "ask") denied = !(await ensureConsent(req.params.appName))
      else if (mode === "blocklist") denied = (await getConsent()) === "denied"
      // "allow-all": no gate.
      if (denied) {
        replyErr(req.id, {
          code: "consent_denied",
          message: "openpicker: this origin is not allowed",
        })
        return
      }

      // Open the URL, pick there, and route the result back (DESIGN.md §5c).
      const outcome = await runCrossTabPick(req.params)
      if (outcome.type === "result") {
        replyOk(req.id, outcome.result)
      } else {
        replyErr(req.id, {
          code: "cancelled",
          message: "openpicker: the user cancelled the picker",
        })
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
        case "activateSelf":
          await browser.runtime.sendMessage({ kind: "activateSelf" }).catch(() => {})
          replyOk(req.id, {})
          return
        case "isTargetOpen": {
          const res = (await browser.runtime
            .sendMessage({ kind: "isTargetOpen" })
            .catch(() => undefined)) as { open?: boolean } | undefined
          replyOk(req.id, { open: !!res?.open })
          return
        }
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

    browser.runtime.onMessage.addListener((message: unknown) => {
      const msg = message as {
        kind?: string
        sourceTabId?: number
        params?: RequestEnvelope<"pick">["params"]
        pickId?: string
      }

      // Toolbar icon → start a pick, so the picker works without the SDK. There is
      // no caller waiting for a result, so confirming copies the selector to the
      // clipboard for the user (see runPicker `copyOnConfirm`).
      if (msg?.kind === "startPick") {
        void runPicker({}, { copyOnConfirm: true })
        return false
      }

      // Cross-tab target tab: background tells us to run the picker here (consent
      // already resolved in the source tab). The result is pushed back to the
      // background so it survives navigation; no response is sent here.
      if (msg?.kind === "crossTab:run" && msg.sourceTabId !== undefined) {
        startCrossTabTarget(msg.sourceTabId, msg.params ?? {}, msg.pickId)
        return false
      }
      return false
    })

    // Resume a cross-tab pick if this tab navigated mid-pick or is an inherited
    // same-origin target (DESIGN.md §5d phase 2).
    void resumeCrossTabTargetOnLoad()
  },
})
