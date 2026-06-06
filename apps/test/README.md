# OpenPicker test page

A page for manually testing the extension. It speaks the OpenPicker protocol
directly over `window.postMessage` — no SDK, just the raw protocol. Served by Vite.

## Use

```bash
pnpm --filter @openpicker/extension build          # build the extension
# Chrome → chrome://extensions → Developer mode → Load unpacked →
#   packages/extension/.output/chrome-mv3
pnpm test:page                                      # vite dev server (http://localhost:5173)
```

Open the URL Vite prints (must be **http**, not `file://`, or the content script's
same-origin check rejects the messages).

- **Ping** — confirm the extension is installed and see its capabilities.
- **Pick on this page** — local pick; choose a screenshot mode (`none` / `element`
  / `viewport`). A returned screenshot is shown below the output.
- **Pick on URL (cross-tab)** — enter a URL; the extension opens it in a new tab,
  you pick there, the tab closes, focus returns here, and the selector (+ optional
  screenshot) appears in the output.
