# openpicker

An open-source CSS element picker. A browser extension plus an npm SDK let **any** web page
invoke an element picker through one open protocol and receive a stable CSS selector.

- **Design:** [DESIGN.md](./DESIGN.md)
- **Wire protocol:** [PROTOCOL.md](./PROTOCOL.md)

## Monorepo layout

```
openpicker/
├── packages/
│   ├── protocol/     # @openpicker/protocol — shared types & constants (source-only, private)
│   ├── sdk/          # openpicker — the npm SDK integrators install (tsup build)
│   └── extension/    # @openpicker/extension — the browser extension (WXT + React)
├── apps/
│   └── playground/   # a sample page to test ping/pick against the extension (Vite)
```

## Tech stack

WXT · React · TypeScript · Tailwind (overlay UI, pending) · `@medv/finder` (selector generation)
· pnpm workspaces · tsup (SDK) · Biome.

## Develop

Requires Node ≥ 20 and pnpm (via `corepack enable`).

```bash
pnpm install            # install everything; runs `wxt prepare` for the extension
pnpm build              # build all packages
pnpm typecheck          # type-check all packages
pnpm dev:ext            # run the extension in dev mode (loads into a browser)
pnpm dev:sdk            # build the SDK in watch mode
```

### Load the extension (unpacked)

```bash
pnpm --filter @openpicker/extension build
```

Then in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** →
select `packages/extension/.output/chrome-mv3`. Click the toolbar icon on any page to start a
pick without writing any code.

### Use the SDK

```ts
import { createOpenpicker } from "openpicker"

const op = createOpenpicker({ appName: "My App" })
if (await op.isAvailable()) {
  const { selector, matchCount, element } = await op.pick({ mode: "unique" })
}
```

### Try it / test it

```bash
pnpm --filter openpicker build              # build the SDK once
pnpm --filter @openpicker/playground dev    # interactive Ping/Pick page

pnpm --filter @openpicker/extension build   # then run the end-to-end test:
pnpm e2e                                     # drives a full pick in headless Chrome
```

## Status

Feature-complete v1, pending a clean end-to-end run. Implemented: `ping`, `pick`, `cancel`,
`highlight`, `clearHighlight`; the full pick flow (per-origin consent prompt → hover → click →
sidebar inspector → OK → `PickResult`), with a highlight overlay and page dimming, a pinnable
bottom bar, a sidebar with an editable selector, a DOM-tree navigator, a live match count,
attribute match-criteria, and a selector-settings popover (unique/list, exclude); plus an options
page to review and revoke per-origin consent.

Verification: `pnpm -r typecheck`, the extension build, and the SDK build all pass (exit 0). The
full in-browser flow has been verified manually by loading the unpacked extension and running a
pick end to end (consent prompt → Allow → hover highlight → click → sidebar inspector → result).

An automated end-to-end harness (`pnpm e2e`, in `e2e/`) is included, but does not pass in every
headless setup: in some environments Chrome does not inject the content script into the test tab
(no isolated world is created — not a picker bug). Prefer manual verification (above) where the
harness can't inject.

Deferred to later: cross-origin iframe resolution, first-class Firefox/Edge builds, a docs site.
See [DESIGN.md](./DESIGN.md) and [PROTOCOL.md](./PROTOCOL.md).

## License

MIT
