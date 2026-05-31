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

/** The union of every method's result shape — what may travel on a response. */
type AnyResult = MethodMap[MethodName]["result"]

/**
 * Content script: the public end of the protocol (PROTOCOL.md §2).
 *
 * Listens on the page's `window` message bus for openpicker requests, validates
 * origin, and replies. v1 skeleton implements `ping` fully; other methods reply
 * with `unsupported` until the picker UI and consent flow land.
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
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
              // Honest capability list for the skeleton; grows as methods land.
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
  },
})
