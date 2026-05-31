# openpicker

SDK for invoking the [openpicker](../../README.md) browser extension to pick a CSS selector
on any page.

```bash
npm install openpicker
```

```ts
import { createOpenpicker } from "openpicker"

const op = createOpenpicker({ appName: "My App" })

if (await op.isAvailable()) {
  const result = await op.pick({ mode: "unique" })
  console.log(result.selector, result.matchCount)
} else {
  // Prompt the user to install the openpicker extension.
}
```

See [PROTOCOL.md](../../PROTOCOL.md) for the wire protocol.
