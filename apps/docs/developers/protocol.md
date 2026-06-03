# Protocol

The SDK and extension talk over a small, versioned `window.postMessage` protocol. You don't need it
to use the SDK — it's documented for anyone building their own client or debugging.

The authoritative spec lives in the repo:
[**PROTOCOL.md**](https://github.com/usertour/openpicker/blob/main/PROTOCOL.md).

## At a glance

- **Transport:** `window.postMessage(envelope, window.origin)`, both directions. Every listener
  validates `event.source === window`, `event.origin === window.origin`, and
  `channel === "openpicker"` before processing; anything else is ignored silently.
- **Envelope:** a fixed shape with `channel`, `v` (protocol major), `kind` (`req` / `res` / `evt`),
  a correlation `id`, and the method/result/error payload.
- **Correlation:** `id` is `op:<instanceId>:<seq>`; a response echoes the request's `id`.
- **Methods (v1):** `ping`, `pick`, `cancel`, `highlight`, `clearHighlight`, `activateSelf`,
  `isTargetOpen`.
- **Versioning:** `v` is the protocol major. Additive changes (new optional params, capabilities,
  events) don't bump it and are feature-detected via the `capabilities` returned by `ping`.

## Discovery

`ping` returns the extension version, supported protocol majors, and a `capabilities` array, so a
client can degrade gracefully on older extensions:

```json
{
  "extensionVersion": "0.1.0",
  "protocolVersions": [1],
  "capabilities": ["ping", "pick", "cancel", "highlight", "clearHighlight", "screenshot", "openUrl", "activateSelf", "isTargetOpen"]
}
```

See [PROTOCOL.md](https://github.com/usertour/openpicker/blob/main/PROTOCOL.md) for the full envelope
fields, examples, and reserved future methods.
