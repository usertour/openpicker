# @openpicker/site

The marketing landing page for **openpicker.dev**. A static site (Vite) with hand-rolled CSS in
the brand palette — hero, features, a developer SDK snippet, and CTAs to the live demo, GitHub, and
npm. Deployed to Cloudflare (Workers static assets).

## Local

```bash
pnpm --filter @openpicker/site dev      # vite dev server
pnpm --filter @openpicker/site build    # -> apps/site/dist
```

## Deploy (Cloudflare Workers, openpicker.dev)

Create a Worker connected to this repo, then set:

- **Build command:** `pnpm install && pnpm --filter @openpicker/site build`
- **Deploy command:** `npx wrangler deploy --config apps/site/wrangler.jsonc`
- **Root directory:** repo root
- **Build watch paths (optional):** `apps/site/*` — so it only rebuilds on site changes.

The Worker's name must match `name` in `apps/site/wrangler.jsonc` (`openpicker-site`). Add the
custom domain `openpicker.dev` (and `www`) to that Worker. Node is pinned to 20 via the repo
`.nvmrc`.

> The separate demo site (apps/demo) deploys from the repo-root `wrangler.jsonc`; this site uses its
> own config via `--config`, so the two don't collide.
