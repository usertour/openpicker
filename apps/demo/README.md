# @openpicker/demo

The public, deployable demo for openpicker. A static site (Vite) that calls the real
[`@openpicker/sdk`](../../packages/sdk): detect the extension, enter a URL, pick an element,
and see the selector come back. This is the page deployed to Cloudflare Pages.

## Local

```bash
pnpm --filter @openpicker/sdk build     # the demo imports the built SDK
pnpm --filter @openpicker/demo dev      # vite dev server
```

## Build (static output)

```bash
pnpm --filter @openpicker/sdk build
pnpm --filter @openpicker/demo build    # -> apps/demo/dist
```

## Deploy (Cloudflare Pages)

- **Build command:** `pnpm install && pnpm --filter @openpicker/sdk build && pnpm --filter @openpicker/demo build`
- **Build output directory:** `apps/demo/dist`
- **Root directory:** repo root
- Set `NODE_VERSION` to `20` (or add a `.nvmrc`); Cloudflare detects pnpm from the lockfile.

> The demo can only complete a pick for visitors who have the openpicker extension installed.
> Until the Chrome Web Store listing exists, it shows unpacked-install instructions.
