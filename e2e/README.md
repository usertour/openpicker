# openpicker E2E

A zero-dependency end-to-end test that loads the built extension into headless
Chrome (over the Chrome DevTools Protocol) and drives the full pick flow against a
fixture page: `ping -> pick -> consent Allow -> hover -> click -> OK -> assert result`.

## Run

```bash
pnpm --filter @openpicker/extension build   # produce .output/chrome-mv3
pnpm e2e                                     # from the repo root
```

By default it loads `packages/extension/.output/chrome-mv3` and uses Google Chrome
at the standard macOS path. Override:

```bash
node e2e/run.mjs /path/to/unpacked-extension
OPENPICKER_CHROME=/path/to/chrome node e2e/run.mjs
```

Prints `PASS` and exits 0 on success.
