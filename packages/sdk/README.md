# @openpicker/sdk

SDK for invoking the [openpicker](https://github.com/usertour/openpicker) browser extension to
pick a CSS selector on any page.

```bash
npm install @openpicker/sdk
```

```ts
import { createOpenpicker, OpenpickerError } from "@openpicker/sdk"

const op = createOpenpicker({ appName: "My App" })

if (await op.isAvailable()) {
  // `url` is required: the extension opens it in a tab, the user picks there,
  // and the selector is routed back here.
  const { selector, matchCount, element } = await op.pick({
    url: "https://app.example.com",
    screenshot: "element", // optional: "none" | "element" | "viewport"
  })
  console.log(selector, matchCount, element)
} else {
  // Prompt the user to install the openpicker extension.
}
```

See the [protocol spec](https://github.com/usertour/openpicker/blob/main/PROTOCOL.md) for the
wire format, and the [main README](https://github.com/usertour/openpicker) for the full API.
