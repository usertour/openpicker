# openpicker static test page

A build-free page for manually testing the extension. It speaks the openpicker
protocol directly over `window.postMessage` — no SDK, no bundler.

## Use

```bash
pnpm --filter @openpicker/extension build          # build the extension
# Chrome → chrome://extensions → Developer mode → Load unpacked →
#   packages/extension/.output/chrome-mv3
pnpm test:page                                      # serve on http://localhost:5599
```

Open `http://localhost:5599/` (must be **http**, not `file://`, or the content
script's same-origin check rejects the messages).

- **Ping** — confirm the extension is installed and see its capabilities.
- **Pick on this page** — local pick; choose a screenshot mode (`none` / `element`
  / `viewport`). A returned screenshot is shown below the output.
- **Pick on URL (cross-tab)** — enter a URL; the extension opens it in a new tab,
  you pick there, the tab closes, focus returns here, and the selector (+ optional
  screenshot) appears in the output.
