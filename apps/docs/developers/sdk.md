# SDK

`@openpicker/sdk` is a tiny, dependency-free client. It does not draw any UI — it starts a pick and
awaits the result; the extension owns the picker overlay and the cross-tab routing.

```bash
npm install @openpicker/sdk
```

## Quick start

```ts
import { createOpenpicker, OpenpickerError } from "@openpicker/sdk"

const op = createOpenpicker({ appName: "My App" })

if (!(await op.isAvailable())) {
  // prompt the user to install the openpicker extension
}

try {
  const { selector, matchCount, element, screenshot } = await op.pick({
    url: "https://app.example.com",
    screenshot: "element",
  })
  console.log(selector, `(matches ${matchCount})`, element)
} catch (err) {
  if (err instanceof OpenpickerError && err.code === "cancelled") {
    // the user closed the picker
  } else {
    throw err
  }
}
```

## `createOpenpicker(options?)`

Returns an `Openpicker` handle.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appName` | `string` | — | Display name shown to the user (informational, never trusted). |
| `pingTimeout` | `number` | `1500` | ms before `ping` assumes the extension isn't installed. |
| `defaultTimeout` | `number` | `3000` | ms for quick ops (`cancel` / `highlight` / `clearHighlight`). |
| `targetWindow` | `Window` | `window` | Window to communicate over. |

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `ping()` | `PingResult` | Probe the extension; negotiate version & capabilities. |
| `isAvailable()` | `boolean` | `true` if the extension responds to a ping. |
| `pick(params)` | `PickResult` | Open `params.url`, let the user pick there, resolve with the result. |
| `cancel()` | `void` | Cancel an in-flight pick (it rejects with `cancelled`). |
| `highlight(selector)` | `HighlightResult` | Highlight matches of a selector without entering pick mode. |
| `clearHighlight()` | `void` | Remove any active highlight. |
| `activateSelf()` | `void` | Bring the calling tab to the foreground (a tab can only focus itself). |
| `isTargetOpen()` | `boolean` | Whether the cross-tab target tab this tab opened is still open. |
| `destroy()` | `void` | Stop listening and reject any in-flight requests. |

## `pick(params)`

| Field | Type | Description |
| --- | --- | --- |
| `url` | `string` *(required)* | Page to open and pick in. Omitting it rejects with `invalid_params`. |
| `screenshot` | `"none" \| "element" \| "viewport"` | Screenshot to include. Defaults to `"none"`. |
| `key` | `string` | Opaque task id; decides whether a later pick reuses the target tab. |
| `appName` | `string` | Overrides the instance `appName` for this call. |

**`PickResult`**

```ts
{
  selector: string
  matchCount: number
  element: { tag: string; id?: string; classes: string[]; text?: string; attributes: Record<string, string> }
  screenshot?: string // data: URL, present only when requested
}
```

`pick` is **cross-tab only** — see [Cross-tab picking](/developers/cross-tab). Error codes are
listed in [Errors](/developers/errors).
