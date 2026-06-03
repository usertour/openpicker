<p align="center">
  <img src="./.github/openpicker.svg" alt="openpicker" width="88" height="88" />
</p>

<h1 align="center">openpicker</h1>

<p align="center">An open-source CSS element picker for the web.</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="#contributing"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="https://www.usertour.io"><img src="https://img.shields.io/badge/maintained%20by-Usertour-867DB3.svg" alt="Maintained by Usertour" /></a>
</p>

> An open-source CSS **element picker** for the web — a browser extension plus a tiny npm SDK,
> connected by one open protocol. Any page can ask the user to point at an element (even on a
> different tab/site) and get back a stable CSS selector.

The extension renders the whole picking experience — a hover highlight, a sidebar inspector with
an editable selector, a DOM-tree navigator, a live match count, and per-site selector settings.
The SDK is a ~3 KB messaging client: it starts a pick and awaits the result. You can also pick
straight from the toolbar, with no code at all.

- 📐 **Design notes:** [DESIGN.md](./DESIGN.md)
- 🔌 **Wire protocol:** [PROTOCOL.md](./PROTOCOL.md)

---

## Why

A web page can already inspect its *own* DOM. What it can't do is ask the user to point at an
element on **another tab or origin** and hand the selector back — browsers isolate origins for
good reason. That cross-tab/cross-origin hop is exactly what an extension can bridge, and it's the
reason openpicker exists. It's a natural fit for product onboarding/tours, event tagging, no-code
automation, scraping config, and anything that needs "let me point at that element."

## Features

- **Cross-tab picking** — open a URL, let the user pick there, route the selector back to the caller.
- **Toolbar picking** — pick on the current page from the toolbar popup; the selector is copied to
  your clipboard. No SDK required.
- **Stable selectors** — built on [`@medv/finder`](https://github.com/antonmedv/finder), with
  built-in filters that skip auto-generated ids and hashed CSS-in-JS / CSS-module class names.
- **Tunable per site** — toggle whether selectors may use id / class / attributes, ignore patterns,
  and an attribute allow-list. Settings are remembered per origin.
- **Inspector UI** — editable selector with live validity + match count, a DOM-tree navigator
  (parent/child/siblings), and the element's attributes — rendered in an isolated Shadow DOM so it
  never clashes with the host page's styles.
- **Optional screenshots** — return a screenshot cropped to the element or of the viewport.
- **User-controlled authorization** — an extension-wide mode (allow all / ask / blocklist), set by
  the user, never by the calling site.
- **Tiny, typed SDK** — promise-based, dependency-free, with a stable error-code surface.

## How it works

Two communication hops; only the first is the public protocol:

```
[ your code ]
     │  function calls
[ openpicker SDK ]  ── window.postMessage ──►  [ extension content script ]   ◄── PUBLIC PROTOCOL
                                                      │  chrome.runtime.*  (extension-internal)
                                               [ background service worker ]
```

The SDK never draws UI — it sends a request and awaits a response. The extension owns the picker
overlay and the cross-tab routing. See [PROTOCOL.md](./PROTOCOL.md) for the envelope format,
versioning, and error model.

## Install

### Extension (unpacked, for now)

```bash
pnpm install
pnpm --filter @openpicker/extension build
```

Then in Chrome: open `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select `packages/extension/.output/chrome-mv3`. Click the toolbar icon on any page to pick
without writing code.

### SDK

```bash
npm install @openpicker/sdk   # or: pnpm add @openpicker/sdk / yarn add @openpicker/sdk
```

> The SDK is published as `@openpicker/sdk`. It only talks to the extension; it does no picking by
> itself, so the extension must be installed in the user's browser.

## Quick start

```ts
import { createOpenpicker, OpenpickerError } from "@openpicker/sdk"

const op = createOpenpicker({ appName: "My App" })

// Bail early if the extension isn't installed.
if (!(await op.isAvailable())) {
  // prompt the user to install the extension…
}

try {
  // `url` is required: the extension opens it in a tab, the user picks there,
  // and the selector is routed back here.
  const { selector, matchCount, element, screenshot } = await op.pick({
    url: "https://app.example.com",
    screenshot: "element", // optional: "none" | "element" | "viewport"
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

## API

`createOpenpicker(options?)` returns an `Openpicker` handle.

**Options**

| Option           | Type      | Default      | Description                                                        |
| ---------------- | --------- | ------------ | ------------------------------------------------------------------ |
| `appName`        | `string`  | —            | Display name shown to the user (informational, never trusted).     |
| `pingTimeout`    | `number`  | `1500`       | ms before `ping` assumes the extension isn't installed.            |
| `defaultTimeout` | `number`  | `3000`       | ms for quick ops (`cancel` / `highlight` / `clearHighlight`).      |
| `targetWindow`   | `Window`  | `window`     | Window to communicate over.                                        |

**Methods**

| Method                       | Returns                  | Description                                                            |
| ---------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `ping()`                     | `PingResult`             | Probe the extension; negotiate version & capabilities.                |
| `isAvailable()`              | `boolean`                | `true` if the extension responds to a ping.                           |
| `pick(params)`               | `PickResult`             | Open `params.url`, let the user pick there, resolve with the result.  |
| `cancel()`                   | `void`                   | Cancel an in-flight pick (it rejects with `cancelled`).               |
| `highlight(selector)`        | `HighlightResult`        | Highlight matches of a selector without entering pick mode.           |
| `clearHighlight()`           | `void`                   | Remove any active highlight.                                          |
| `activateSelf()`             | `void`                   | Bring the calling tab to the foreground (a tab can only focus itself).|
| `isTargetOpen()`             | `boolean`                | Whether the cross-tab target tab this tab opened is still open.       |
| `destroy()`                  | `void`                   | Stop listening and reject any in-flight requests.                     |

**`pick(params)` — `PickParams`**

| Field        | Type                            | Description                                                            |
| ------------ | ------------------------------- | --------------------------------------------------------------------- |
| `url`        | `string` *(required)*           | Page to open and pick in. Omitting it rejects with `invalid_params`.   |
| `screenshot` | `"none" \| "element" \| "viewport"` | Screenshot to include. Defaults to `"none"`.                      |
| `exclude`    | `string`                        | Extra regex of id/class names to exclude, on top of the built-ins.    |
| `key`        | `string`                        | Opaque task id; decides whether a later pick reuses the target tab.   |
| `iframe`     | `boolean`                       | Request subframe resolution (may report `unsupported` in v1).         |
| `appName`    | `string`                        | Overrides the instance `appName` for this call.                       |

**`PickResult`** → `{ selector, matchCount, element: { tag, id, classes, text, attributes }, screenshot? }`

**Error codes** (`OpenpickerError.code`): `extension_not_installed`, `unsupported_protocol`,
`consent_denied`, `cancelled`, `invalid_params`, `unsupported`, `timeout`, `internal_error`.

## Authorization & security

The **real safeguard is user presence** — nothing is produced unless the user actively hovers,
clicks an element, and confirms. On top of that, the user picks an extension-wide **authorization
mode** on the options page (never settable by the calling site):

- **Allow all** *(default)* — any origin may launch the picker.
- **Ask each site** — the first call from an origin prompts; the decision is remembered.
- **Blocklist** — every origin is allowed except ones the user blocks.

Toolbar picks are always allowed (they're user-initiated). The page-supplied `appName` is
display-only; only the verified `event.origin` is authoritative. See [PROTOCOL.md](./PROTOCOL.md) §7.

## Monorepo layout

```
openpicker/
├── packages/
│   ├── protocol/     # @openpicker/protocol — shared types & constants (source-only, private)
│   ├── sdk/          # openpicker — the npm SDK integrators install (tsup build)
│   └── extension/    # @openpicker/extension — the browser extension (WXT + React + Tailwind, MV3)
├── apps/
│   ├── test/         # interactive Ping/Pick test page
│   └── playground/   # a minimal sample page
└── e2e/              # end-to-end harness (headless Chrome)
```

## Development

Requires **Node ≥ 20** and **pnpm** (via `corepack enable`).

```bash
pnpm install            # install everything; runs `wxt prepare` for the extension
pnpm dev:ext            # run the extension in dev mode (auto-loads into a browser)
pnpm dev:sdk            # build the SDK in watch mode
pnpm test:page          # serve the interactive Ping/Pick test page (apps/test)

pnpm build              # build all packages
pnpm typecheck          # type-check all packages
pnpm lint               # Biome lint/format check
pnpm format             # Biome format --write
pnpm e2e                # end-to-end pick in headless Chrome (see caveat below)
```

A Firefox build is available via the extension package (`pnpm --filter @openpicker/extension
dev:firefox` / `build:firefox`), but Chromium (MV3) is the primary target.

## Tech stack

[WXT](https://wxt.dev) · React 19 · TypeScript · Tailwind CSS v4 (Shadow-DOM-isolated UI) ·
[`@medv/finder`](https://github.com/antonmedv/finder) · pnpm workspaces · tsup (SDK) ·
[Biome](https://biomejs.dev).

## Browser support

Chrome / Chromium / Edge (Manifest V3). Firefox is experimental via the `-b firefox` build target.

## Project status

`v1`, feature-complete. Implemented: `ping`, `pick`, `cancel`, `highlight`, `clearHighlight`,
`activateSelf`, `isTargetOpen`; the full pick flow (hover → click → sidebar inspector → confirm →
`PickResult`) with screenshots, per-origin selector settings, the authorization modes, a toolbar
popup, and an options page. `pnpm -r typecheck`, the extension build, and the SDK build all pass.

The full in-browser flow is verified by loading the unpacked extension and running a pick end to
end. An automated harness (`pnpm e2e`) is included but does not pass in every headless setup — in
some environments Chrome won't inject the content script into the test tab (not a picker bug).

**Roadmap:** cross-origin iframe resolution · Shadow-DOM-piercing selectors · published store
builds · a docs site. See [DESIGN.md](./DESIGN.md) §10 and [PROTOCOL.md](./PROTOCOL.md) §10.

## Contributing

Issues and PRs are welcome. Before opening a PR:

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Keep the codebase original (no copied code), and write all docs and commit messages in English.

## License

[MIT](./LICENSE) © Usertour
