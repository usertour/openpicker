# @openpicker/demo

The public, deployable demo for OpenPicker. A static site (Vite) that calls the **published**
[`@openpicker/sdk`](https://www.npmjs.com/package/@openpicker/sdk) — not the local workspace copy —
so it always exercises the real package a user would `npm install`. It detects the extension,
opens a URL, picks an element, and shows the selector that comes back. This is the page deployed to
Cloudflare Pages.

> The dependency is pinned via a package alias: `"@openpicker/sdk": "npm:@openpicker/sdk@^0.1.0"`.
> The `npm:` prefix forces resolution from the registry instead of the same-named workspace package.
> Bump the range when the SDK ships a new minor (e.g. `^0.2.0`).

For local hacking on the picker itself, use `apps/test` (raw protocol) or `apps/playground` (SDK
scratch page) — this demo intentionally tracks the released package.

## Build (static output)

```bash
pnpm install                            # fetches the published @openpicker/sdk
pnpm --filter @openpicker/demo build    # -> apps/demo/dist
```

## Deploy (Cloudflare Pages)

- **Build command:** `pnpm install && pnpm --filter @openpicker/demo build`
- **Build output directory:** `apps/demo/dist`
- **Root directory:** repo root
- Set `NODE_VERSION` to `20` (or add a `.nvmrc`); Cloudflare detects pnpm from the lockfile.

> The demo can only complete a pick for visitors who have the OpenPicker extension installed.
> Until the Chrome Web Store listing exists, it shows unpacked-install instructions.
