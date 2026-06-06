# @openpicker/protocol

The open [openpicker](https://openpicker.dev) postMessage protocol: the wire types, constants, and
selector helpers that the browser extension and any client share. Website:
[openpicker.dev](https://openpicker.dev) · Docs: [docs.openpicker.dev](https://docs.openpicker.dev)

Most integrations should use [`@openpicker/sdk`](https://www.npmjs.com/package/@openpicker/sdk),
which wraps this protocol in a friendly client. Depend on this package directly only when building
your own client (another SDK, a different extension, a non-browser bridge) against the same wire
format.

```bash
npm install @openpicker/protocol
```

```ts
import {
  CHANNEL,
  PROTOCOL_VERSION,
  isEnvelope,
  matchesSelectorConfig,
  type PickParams,
  type SelectorConfig,
} from "@openpicker/protocol"
```

This package ships:

- **Constants** — `CHANNEL`, `PROTOCOL_VERSION`.
- **Envelopes** — `RequestEnvelope`, `ResponseEnvelope`, `EventEnvelope`, and the `isEnvelope` guard.
- **Methods** — `MethodMap` plus the params/result types (`PickParams`, `PickResult`, `SelectorConfig`, …).
- **Errors** — `ProtocolError`, `ErrorCode`.
- **Selector helpers** — `tokenizeSelector`, `matchesSelectorConfig`, and their token types.

See the [protocol spec](https://github.com/usertour/openpicker/blob/main/PROTOCOL.md) for the full
wire format.
