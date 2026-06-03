# openpicker Protocol v1

> The contract between the **page SDK** (npm) and the **browser extension**. It defines how
> they discover each other, exchange requests/responses, correlate them, handle consent, and
> stay compatible across versions. All naming is original to openpicker.

This is a design spec. JSON shapes below describe the wire format, not an implementation.

---

## 1. Scope & layers

There are two communication hops; only the first is part of this public protocol:

```
[ integrator code ]
       │  function calls
[ openpicker SDK ]  ── window.postMessage ──►  [ extension content script ]   ◄── THIS PROTOCOL
                                                       │  chrome.runtime.*  (extension-internal)
                                                [ background service worker ]
```

- **Public protocol (this doc):** SDK ⇄ content script, over `window.postMessage`.
- **Internal (out of scope):** content script ⇄ background (screenshots, consent storage, etc.).
  Integrators never see this; it can change freely without a protocol bump.

The picker UI (overlay, bottom bar, sidebar) is rendered entirely by the **extension**. The SDK
only starts a pick and receives the result — it does not draw UI. So v1 needs only
request/response plus a small set of notifications.

---

## 2. Transport & origin security

- Both directions use `window.postMessage(envelope, window.origin)`.
- Every listener MUST validate, before processing:
  - `event.source === window` (same window, not an embedded/parent frame)
  - `event.origin === window.origin` (same origin)
  - `envelope.channel === "openpicker"` (ignore unrelated messages)
- Messages failing any check are ignored silently (no reply), to avoid leaking behavior to
  hostile frames.
- The extension gates `pick` by an **authorization mode** (default open; §7).

---

## 3. Envelope format

Every message shares one envelope:

```json
{
  "channel": "openpicker",
  "v": 1,
  "kind": "req",
  "id": "op:7Hk2:12",
  "method": "pick",
  "params": { }
}
```

| Field | Type | Present on | Meaning |
|---|---|---|---|
| `channel` | `"openpicker"` | all | Fixed discriminator |
| `v` | integer | all | Protocol **major** version (this doc: `1`) |
| `kind` | `"req" \| "res" \| "evt"` | all | Message kind |
| `id` | string | `req`, `res` | Correlation id (§4); echoed verbatim on the response |
| `method` | string | `req` | Method name (§6) |
| `params` | object | `req` | Method arguments |
| `ok` | boolean | `res` | `true` → `result` present; `false` → `error` present |
| `result` | object | `res` (ok) | Method result |
| `error` | `{code,message,data?}` | `res` (!ok) | Failure (§8) |
| `event` | string | `evt` | Notification name (§6) |
| `data` | object | `evt` | Notification payload |

Unknown fields MUST be ignored (forward compatibility). Receivers must not assume field order.

---

## 4. Request correlation

- `id` format: `op:<instanceId>:<seq>`
  - `instanceId` — a short random id (e.g. nanoid) generated once per SDK instance. Disambiguates
    multiple SDK instances on the same page (host app + an embedded widget both using openpicker).
  - `seq` — a monotonically increasing counter within that instance.
- A response MUST echo the request's `id` exactly.
- The SDK keeps a pending map `id → { resolve, reject, timer }`. On a matching `res` it settles
  the promise and deletes the entry. On timeout it rejects with `timeout` and deletes the entry
  (no leaks). Responses with an unknown `id` are ignored.
- `evt` messages carry no `id` and are not correlated to a single request; they are broadcast
  notifications the SDK may surface via callbacks.

---

## 5. Timeouts

| Request | Default timeout | Rationale |
|---|---|---|
| `ping` | ~1500 ms | If no `pong`, assume the extension is not installed |
| `pick` | none (or very long) | User-driven; may take as long as the user needs |
| `cancel`, `highlight`, `clearHighlight` | ~3000 ms | Quick operations |

Timeouts are SDK-side. Defaults are configurable by the integrator.

---

## 6. Methods & events (v1)

### 6.1 `ping` (discovery)
SDK → extension. Detects presence and negotiates version/capabilities.

Request `params`: `{}` (optionally `{ appName?: string }` for context).

Response `result`:
```json
{
  "extensionVersion": "1.4.0",
  "protocolVersions": [1],
  "capabilities": ["pick", "highlight", "exclude", "screenshot", "openUrl", "activateSelf", "isTargetOpen"]
}
```
- `protocolVersions` — protocol majors the extension supports.
- `capabilities` — feature flags so the SDK can degrade gracefully on older extensions.
- If the SDK gets no `pong` before the timeout, it synthesizes `extension_not_installed`.

### 6.2 `pick` (start element selection)
SDK → extension. Activates the picker; resolves when the user confirms (OK) in the sidebar.

Request `params` (`url` required, the rest optional):
```json
{
  "url": "https://example.com",
  "exclude": "css-|sc-|jsx-",
  "iframe": false,
  "screenshot": "element",
  "key": "onboarding-step-1",
  "appName": "Acme Onboarding"
}
```
- `exclude`: extra regex of id/class names to exclude (layered on the built-in blacklist).
- `iframe`: request subframe resolution (v1 may report unsupported; see roadmap).
- `screenshot`: `"none"` (default) | `"element"` (crop to the selected element) | `"viewport"`
  (full visible viewport). Booleans are accepted for compatibility: `true`→`"element"`,
  `false`→`"none"`. Reserved (not implemented): `"fullpage"`.
- `url` (**required**): the extension opens this URL in a **new tab**, the user picks there, and the
  result is routed back to the calling tab; focus returns to the source tab on finish. The target
  tab is **not** closed (the caller/user keeps it; a later pick may reuse it). `pick` is cross-tab
  only — an extension earns its keep by crossing the tab/origin boundary; a page can already script
  its own DOM, so same-tab picking is not an SDK capability (only the toolbar offers it, for humans).
  Omitting `url` returns `invalid_params`. Requires the `"openUrl"` capability. See DESIGN.md §5c/§5d.
- `key`: optional, caller-supplied opaque string identifying "which task" this pick is for. Used
  only to decide whether a follow-up `url` pick reuses the existing target tab or opens a new one
  (equality compare; never interpreted). No `key` → reuse is decided by host/URL alone. See
  DESIGN.md §5d.
- `appName`: shown in the consent prompt (informational, not trusted).

Response `result` (on OK):
```json
{
  "selector": "div[data-hveid] > div:nth-of-type(5)",
  "matchCount": 1,
  "element": {
    "tag": "div",
    "id": "LS80J",
    "classes": ["o3j99", "LLD4me"],
    "text": "Google",
    "attributes": { "aria-label": "Google" }
  },
  "screenshot": "data:image/png;base64,…"
}
```
- `screenshot` present only if requested (a `data:` URL; cropped to the element for `"element"`).

Failure: `consent_denied`, or `cancelled` if the user closes/cancels the picker (including closing
the cross-tab target tab before finishing).

### 6.3 `cancel`
SDK → extension. Cancels an in-flight `pick`. The pending `pick` rejects with `cancelled`.
`cancel` itself responds `{ "ok": true, "result": {} }`.

### 6.4 `highlight` (reverse lookup)
SDK → extension. Highlights element(s) matching a given selector without entering pick mode.

Request `params`: `{ "selector": string }`
Response `result`: `{ "matchCount": number }`

### 6.5 `clearHighlight`
SDK → extension. Removes any active highlight. Response `result`: `{}`.

### 6.6 `activateSelf`
SDK → extension. Brings the **calling tab** to the foreground (a page cannot focus its own
background tab; only the extension can). A tab can only focus itself — there is no parameter to
target another tab, which keeps it from being used to hijack focus. Response `result`: `{}`.

### 6.7 `isTargetOpen`
SDK → extension. Reports whether the cross-tab target tab opened by this (source) tab is still
open. Response `result`: `{ "open": boolean }`. Useful for showing "target page is open/closed"
state. A stale mapping (tab already gone) is cleaned up and reported as `open: false`.

### 6.8 Events (`evt`)
v1 defines none as required. The SDK must ignore unknown events.

Reserved for future use: `hoverChange` (live element under the cursor), `consentChange`.

---

## 7. Authorization & security model

An open API means **any** origin can call `pick`. The **real safeguard is user presence**: nothing
is produced without the user actively hovering, clicking an element, and confirming in the target
tab. On top of that, the user chooses an **authorization mode** (extension-wide, set on the options
page — never by the calling site). See DESIGN.md §6.

- **`allow-all` (default).** Any origin may launch the picker. Relies on user presence; no prompt.
- **`ask`.** The first time an origin calls `pick`, a prompt naming the requesting **origin** (and
  the untrusted `appName` if provided) lets the user allow or deny; the decision is remembered and
  not asked again until changed on the options page.
- **`blocklist`.** Every origin is allowed except ones the user has blocked.

A blocked/denied origin → `pick` rejects with `consent_denied`. Decisions are stored per origin
(`granted`/`denied`) and managed on the options page (review, toggle, reset, add by hand).

- **Toolbar picks are always allowed** — they are user-initiated (the popup's "Pick" button), not
  site-initiated, so no mode applies.
- **Trust boundary.** `appName`/`appId` from the page are display-only and never trusted for
  authorization; only the verified `event.origin` is authoritative.
- **No silent capability.** The extension never auto-injects vendor SDKs or runs page code beyond
  what a method explicitly does (explicit non-goal of the project).
- **API keys: not required.** Origin + the authorization mode is the gate. A registry/API-key layer
  is a possible later addition for analytics, not for security.

---

## 8. Error codes

`error.code` is a stable string; `error.message` is human-readable; `error.data` is optional.

| Code | Meaning |
|---|---|
| `extension_not_installed` | SDK-synthesized when `ping` times out |
| `unsupported_protocol` | No overlapping `protocolVersions` between SDK and extension |
| `consent_denied` | The origin is not allowed (denied in `ask`, or blocked in `blocklist`) |
| `cancelled` | The user cancelled/closed the picker |
| `invalid_params` | Malformed `params` for the method |
| `unsupported` | Method/option not supported by this extension (e.g. `iframe` in v1) |
| `timeout` | SDK-side: no response within the timeout |
| `internal_error` | Unexpected extension failure |

---

## 9. Versioning & compatibility

- `v` is the protocol **major**. Breaking changes bump it. Additive changes (new optional
  params, new capabilities, new events) do NOT bump it and must be feature-detected via
  `capabilities`.
- The extension SHOULD support multiple recent majors simultaneously and advertise them in
  `pong.protocolVersions`. The SDK picks the highest common major; if none, it fails with
  `unsupported_protocol`.
- The SDK and extension version independently (different npm/store release cadences), so neither
  may assume the other is the same age. Always negotiate via `ping` before relying on a feature.

---

## 10. Reserved for the future

Named here so the envelope and method space leave room (not implemented in v1):

- `screenshot` as a standalone method (beyond the `pick` option)
- `screenshot: "fullpage"` (scroll-and-stitch capture beyond the viewport)
- Cross-frame / subframe resolution for iframes (`iframe: true`)
- Shadow DOM piercing selectors
- `evt` streaming (`hoverChange`) for SDK-driven custom UI
- A registry / API-key handshake for allowlisting & analytics

---

## 11. Example exchange

```
SDK  → ext : {channel:"openpicker", v:1, kind:"req", id:"op:7Hk2:1", method:"ping", params:{}}
ext  → SDK : {channel:"openpicker", v:1, kind:"res", id:"op:7Hk2:1", ok:true,
              result:{extensionVersion:"1.4.0", protocolVersions:[1],
                      capabilities:["pick","highlight","exclude","screenshot","openUrl","activateSelf","isTargetOpen"]}}

SDK  → ext : {channel:"openpicker", v:1, kind:"req", id:"op:7Hk2:2", method:"pick",
              params:{url:"https://app.example.com", appName:"Acme Onboarding"}}
        (default allow-all mode → no prompt; in "ask" mode the origin is
         prompted once. User picks an element, refines in the sidebar, clicks OK)
ext  → SDK : {channel:"openpicker", v:1, kind:"res", id:"op:7Hk2:2", ok:true,
              result:{selector:"button.cta", matchCount:1,
                      element:{tag:"button", classes:["cta"], text:"Get started"},
                      screenshot:undefined}}}
```
