# @openpicker/docs

The documentation site for openpicker (**docs.openpicker.dev**), built with
[VitePress](https://vitepress.dev). User guide + developer/SDK reference. Deployed to Cloudflare
(Workers static assets), like the rest of the apps.

## Local

```bash
pnpm --filter @openpicker/docs dev      # vitepress dev server
pnpm --filter @openpicker/docs build    # -> apps/docs/.vitepress/dist
```

## Deploy (Cloudflare Workers, docs.openpicker.dev)

Create a Worker connected to this repo, then set:

- **Build command:** `pnpm install && pnpm --filter @openpicker/docs build`
- **Deploy command:** `npx wrangler deploy --config apps/docs/wrangler.jsonc`
- **Root directory:** repo root
- **Build watch paths:** `apps/docs/**`, `.nvmrc`, `pnpm-lock.yaml`, `package.json`

The Worker's name must match `name` in `apps/docs/wrangler.jsonc` (`openpicker-docs`). Add the custom
domain `docs.openpicker.dev` to that Worker.

## Structure

- `index.md` — home (hero + feature cards)
- `guide/` — user guide (getting started, using the picker, configuring selectors, authorization, appearance)
- `developers/` — SDK, cross-tab picking, protocol, errors
- `.vitepress/config.ts` — nav, sidebar, theme; `.vitepress/theme/custom.css` — brand colors
