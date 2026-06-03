# Chrome Web Store listing kit

Everything needed to submit `@openpicker/extension` to the Chrome Web Store. The artifact to
upload is built with `pnpm --filter @openpicker/extension zip` →
`packages/extension/.output/openpickerextension-<version>-chrome.zip`.

---

## Store listing

**Name**

```
openpicker — CSS element picker
```

**Summary** (≤ 132 chars)

```
Point at any element on a page and get a stable CSS selector back — for product tours, event tagging, automation, and testing.
```

**Category:** Developer Tools

**Detailed description**

```
openpicker is an open-source element picker for the web. Click the toolbar button, point at any
element on the page, and openpicker generates a stable CSS selector for it — then copies it to your
clipboard. Apps can also drive it programmatically through the open-source @openpicker/sdk to let
their users pick an element (even on another tab) and get the selector back.

Why openpicker:
• Stable selectors — built on a proven selector engine, with filters that skip auto-generated ids
  and hashed CSS-in-JS / CSS-module class names.
• Tune it per site — choose whether selectors use id / class / attributes, set ignore patterns and
  an attribute allow-list; remembered per website.
• Inspect as you go — editable selector with a live match count, a DOM-tree navigator, and the
  element's attributes, all in an overlay that never clashes with the page.
• Optional screenshots — capture the element or the viewport along with the selector.
• You're in control — an extension-wide authorization mode (allow all / ask / blocklist) that only
  you set; nothing is captured without you picking and confirming.
• Private by design — no servers, no tracking, no data leaves your browser.

openpicker is free and open source (MIT). Source, docs, and the SDK:
https://github.com/usertour/openpicker
```

**Privacy policy URL**

```
https://github.com/usertour/openpicker/blob/main/PRIVACY.md
```

**Homepage / support**

- Website: https://openpicker.dev
- Support: https://github.com/usertour/openpicker/issues

> If the listing is still in review, don't edit the live listing's Homepage URL yet — update it to
> https://openpicker.dev after it's approved (editing mid-review can reset the queue).

---

## Privacy practices tab (required answers)

**Single purpose**

```
openpicker lets the user point at an element on a web page and returns a stable CSS selector for it.
```

**Permission justifications**

- **Host permissions (`<all_urls>`)**: The user can start a pick on any website they choose, so the
  extension must inject the picker overlay and optionally capture a screenshot on that page. The set
  of sites is not known in advance, so broad host access is required.
- **`tabs`**: To open a target URL in a new tab, route the resulting selector back to the tab that
  started the pick, and return focus to it.
- **`activeTab`**: To act on the current tab when the user starts a pick from the toolbar.
- **`storage`**: To save the user's per-site selector settings and authorization decisions locally.
- **Remote code**: Not used. The extension bundles all its code and never executes remote code.

**Data usage** (declare on the form)

- Does **not** collect or transmit any user data; there are no servers.
- Does **not** sell or share data, and does **not** use data for anything beyond the single purpose.
- All settings are stored locally in the browser only.

---

## Assets

- **Icon (128×128):** `packages/extension/public/icon/128.png`
- **Small promo tile (440×280):** `.github/store/promo-440x280.png`
- **Screenshots (1280×800, PNG/JPEG, 1–5 required):** capture the real UI — suggested shots:
  1. The picker sidebar mid-pick (overlay + selector + match count) on a real site.
  2. The toolbar popup ("Pick an element on this page").
  3. The options page (authorization modes).
  Use a clean browser window at 1280×800; crop to exactly 1280×800.

---

## Submission steps (you do these)

1. Register a Chrome Web Store developer account (one-time US$5): https://chrome.google.com/webstore/devconsole
2. **Add new item** → upload `openpickerextension-0.1.0-chrome.zip`.
3. Fill the **Store listing** (name, summary, description, category, icon, screenshots, promo tile).
4. Fill the **Privacy practices** tab (single purpose, permission justifications, data-usage
   declarations, privacy policy URL above).
5. Submit for review. Review typically takes a few hours to a few days; broad host permissions can
   add scrutiny — the justifications above address them.
6. After it's published, send me the Web Store URL and I'll swap the demo's "install unpacked"
   prompt for a one-click store link.
