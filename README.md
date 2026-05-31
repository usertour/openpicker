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
select `packages/extension/.output/chrome-mv3`.

### Try it

```bash
pnpm --filter openpicker build      # build the SDK once
pnpm --filter @openpicker/playground dev
```

Open the playground URL, click **Ping extension** — with the extension loaded it returns the
extension version, supported protocol versions, and capabilities.

## Status

Skeleton: protocol, SDK, and extension build and type-check; the `ping` method round-trips
end-to-end. `pick` and the picker UI (bottom bar, highlight overlay, sidebar inspector) are the
next milestone — see [DESIGN.md](./DESIGN.md).

## License

MIT
