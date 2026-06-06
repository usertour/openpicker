# Errors

The SDK rejects with an `OpenpickerError` that carries a stable `code` (and a human-readable
`message`, plus optional `data`). Branch on `code`, not the message.

```ts
import { OpenpickerError } from "@openpicker/sdk"

try {
  await op.pick({ url: "https://app.example.com" })
} catch (err) {
  if (err instanceof OpenpickerError) {
    switch (err.code) {
      case "cancelled":
        // the user closed/cancelled the picker
        break
      case "consent_denied":
        // this origin isn't allowed (see Authorization)
        break
      case "extension_not_installed":
        // prompt the user to install OpenPicker
        break
      default:
        // surface err.message
    }
  }
}
```

## Codes

| Code | Meaning |
| --- | --- |
| `extension_not_installed` | The SDK got no response to `ping` within the timeout. |
| `unsupported_protocol` | No overlapping protocol version between the SDK and the extension. |
| `consent_denied` | The origin isn't allowed (denied in *Ask*, or blocked in *Blocklist*). |
| `cancelled` | The user cancelled or closed the picker. |
| `invalid_params` | Malformed params for the method (e.g. `pick` without a `url`). |
| `unsupported` | The method/option isn't supported by this extension. |
| `timeout` | SDK-side: no response within the timeout. |
| `internal_error` | Unexpected extension failure. |

## Tip

Call `isAvailable()` (a wrapped `ping`) before showing a "pick" affordance, so you can guide the
user to install the extension instead of letting `pick` fail later.
