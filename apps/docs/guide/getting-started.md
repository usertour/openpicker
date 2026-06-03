# Getting started

**openpicker** is an open-source CSS element picker for the web. It has two parts:

- A **browser extension** that renders the whole picking experience — a hover highlight, a sidebar
  inspector, a DOM-tree navigator, a live match count, and per-site selector settings.
- A tiny **SDK** ([`@openpicker/sdk`](/developers/sdk)) that lets a web app start a pick and receive
  the resulting selector.

You can pick in two ways: straight from the **toolbar** (no code), or programmatically via the SDK.

## Install the extension

> The extension isn't on the Chrome Web Store yet. Until then, load it unpacked from source.

1. Clone the repo and build the extension:
   ```bash
   pnpm install
   pnpm --filter @openpicker/extension build
   ```
2. Open `chrome://extensions` and enable **Developer mode** (top right).
3. Click **Load unpacked** and select `packages/extension/.output/chrome-mv3`.

You'll see the openpicker icon in the toolbar.

## Pick from the toolbar

1. Open any page.
2. Click the openpicker toolbar icon → **Pick an element on this page**.
3. Hover to highlight, click to select, refine in the sidebar if needed.
4. Click **Copy** — the selector is on your clipboard.

That's it — no code required. See [Using the picker](/guide/using-the-picker) for the full flow.

## Pick from your app (SDK)

Install the SDK and start a pick. The extension opens the URL, the user picks there, and the
selector comes back to your app:

```bash
npm install @openpicker/sdk
```

```ts
import { createOpenpicker } from "@openpicker/sdk"

const op = createOpenpicker({ appName: "My App" })

if (await op.isAvailable()) {
  const { selector, matchCount } = await op.pick({ url: "https://app.example.com" })
  console.log(selector, matchCount)
}
```

See the [SDK reference](/developers/sdk) for the full API.

## Try it now

The [live demo](https://demo.openpicker.dev) is a real caller of `@openpicker/sdk` — install the
extension, then run a pick from the demo.
