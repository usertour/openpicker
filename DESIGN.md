# openpicker Design

> An open-source CSS element picker. Ships a browser extension + npm SDK so that
> any third-party web page can invoke an element picker through one open protocol
> and receive a stable CSS selector.

---

## 1. Goals

Turn "visually select an element on a page and generate a stable selector" into an
**open, generic, reusable** browser primitive.

- Any product (onboarding, no-code, test automation, scraper config, etc.) can integrate it
- Integrators install one npm SDK and call it to launch the picker
- The browser extension provides the actual selection UI and cross-page capabilities
- Protocol, SDK, and extension are all open source, with naming and implementation written from scratch

**Explicit non-goals:** no coupling to any specific SaaS; no "inject a vendor's SDK into the
page" lock-in behavior. All code and protocol naming are written from scratch.

### 1.1 Design principle: openness by parameter

openpicker is a platform, not one product's tool. Capabilities are exposed as **parameters and
extensible enums**, not hardcoded behavior, so integrators decide what fits their use case:

- **Behavior is opt-in via parameters / string enums**, never baked in. Examples already in v1:
  selector `mode` (`unique` | `list`), `exclude` regex, screenshot range (§ below). New behavior
  is added as a new option, not a new fork in the code.
- **The protocol is forward-extensible.** Enums are strings (room for new values), and the message
  envelope ignores unknown fields, so new options/capabilities don't break older SDKs/extensions.
- **Safe defaults, always overridable.** Each option defaults to the safe/cheap choice (e.g.
  `screenshot: "none"`, `mode: "unique"`), but every default can be overridden by the caller.
- **Leave extension points; don't pre-build unproven needs.** Reserve enum values / capability
  flags for likely futures, but implement only what's validated (e.g. `screenshot` reserves but
  does not yet implement `"fullpage"`).

---

## 2. Architecture

```
┌─────────────────────────────────────────────┐
│  Integrator page (any origin)                 │
│                                               │
│   Integrator code                             │
│     └── calls openpicker SDK (npm)            │
│           │  window.postMessage (with id)     │
│           ▼                                    │
│   content script  ◄── injected by extension    │
│     └── renders picker overlay (Shadow DOM)    │
│     └── generates selector, returns result     │
│           │  chrome.runtime.sendMessage        │
│           ▼                                    │
│   background (service worker)                  │
│     └── permissions/consent, screenshot, etc.  │
└─────────────────────────────────────────────┘
```

Three publishable units:
1. **extension** — the browser extension (content script + background + popup/options)
2. **sdk** — the npm package for integrators, wrapping postMessage communication
3. **protocol** — shared protocol types and constants, depended on by both extension and sdk

---

## 3. Tech Stack (decided)

| Area | Choice |
|---|---|
| Extension framework | **WXT** |
| UI framework | **React** |
| Language | **TypeScript** |
| Styling | **Tailwind CSS** |
| Manifest | MV3 |
| Package manager / repo | pnpm workspaces (monorepo) |
| SDK build | tsup (ESM + CJS + d.ts) |
| Testing | Vitest (unit) + Playwright (E2E, loads unpacked extension) |
| Lint/format | Biome |
| Versioning/release | Changesets + GitHub Actions |
| Docs site | TBD (candidate: Astro Starlight) |

### Known one-time setup cost
- **Tailwind into Shadow DOM**: the overlay must live in a Shadow DOM for style isolation,
  so the compiled Tailwind CSS must be injected into the shadow root
  (WXT `createShadowRootUi` + `cssInjectionMode: 'ui'`).
  This is a one-time configuration handled when we reach the overlay; it does not block early work.

### Proposed repo layout
```
openpicker/
├── packages/
│   ├── extension/       # WXT + React + TS + Tailwind
│   ├── sdk/             # tsup + TS, for integrators
│   └── protocol/        # shared protocol types + constants
├── apps/
│   ├── docs/            # docs site
│   └── playground/      # local debugging sample page
├── e2e/                 # Playwright
└── pnpm-workspace.yaml
```

---

## 4. Communication Protocol

> Full spec drafted in **PROTOCOL.md** (v1). Summary below.

Agreed points:

- **Message envelope**: a channel identifier + `protocolVersion` + `requestId` + `kind` + `payload`
- **Request/response correlation**: each call gets a unique `requestId`; the SDK keeps a
  `Map<requestId, {resolve, reject, timeout}>` and resolves on the matching reply.
  **A timeout is mandatory**, and entries must be cleaned up to prevent leaks
- **Extension presence detection**: the SDK pings on init; no pong before timeout → throw
  "extension not installed" so the integrator can degrade gracefully
- **Security check**: message listeners must verify `event.source === window && event.origin === window.origin`
- **Multiple instances**: prefix `requestId` with an instance id to avoid cross-talk between
  multiple SDK instances on the same page
- **Versioning**: pong carries the protocol version; the extension stays backward compatible
  with older SDKs for several versions
- All protocol naming and fields are original, reusing nothing from existing products

---

## 5. Picker Interaction & Selector Generation (to be detailed)

### 5.1 Interaction flow (DevTools-like)
- Activate → overlay follows the cursor (throttle + rAF)
- Hover → highlight the current element (box-model outline + translucent fill), with a floating
  label showing tag / size / selector preview
- Click → lock and return the selector
- `Esc` to cancel; `↑/↓` to walk up/down the DOM tree (select parent/child)
- (Optional) after lock, a small panel to manually edit the selector with live match count

#### Event handling
All page-level listeners attach in the **capture** phase so the picker intercepts before the page:
- `mousemove` (capture) → resolve `event.target`, recompute and reposition the highlight box
- `pointerdown` (capture) → left button: lock + emit selector; right button: cancel picking
- `click` / `contextmenu` (capture) → `stopPropagation()` + `preventDefault()` to **swallow** the
  page's own click/menu so picking never triggers app behavior
- `keydown` (capture) → `Esc` cancels (later: `↑/↓` to walk the DOM tree)
- While active, add a body class to force the crosshair cursor and disable text selection

### 5.1b One panel for the whole pick (no bottom bar)
There is a single docked side panel for the entire pick — no separate bottom bar. (An earlier
design had a bottom toolbar during hover; it was removed in favor of one persistent panel.) The
panel renders inside the Shadow DOM, fixed full-height on the right (swappable to the left).

- **Hover phase** (still finding an element): the panel guides the user ("Move your mouse and click
  an element to select it"), shows a **read-only live preview** of the selector under the cursor,
  and a live match count. Header has swap-side (⇄) and close (✕); `Esc` also cancels.
- **Locked phase** (element selected): the same panel becomes the inspector (§5.1d) — editable
  selector + ⚙ settings, DOM-tree navigator, match count, attribute criteria, and a Close/OK footer.

The page overlays (highlight box, ruler guides, tag tooltip) track the hovered element while
finding and the locked element once selected.

### 5.1c Reverse lookup (highlight a stored selector)
Beyond picking, support resolving a previously stored selector back to a live element (for
preview/measurement). v1 can use plain `querySelector` + a rAF loop that re-measures
`getBoundingClientRect()` and repositions the highlight; treat richer fuzzy/“precision”
matching as a later enhancement.

### 5.1d Post-selection sidebar (the inspector panel)
After the user clicks an element, the bottom bar gives way to a **docked sidebar**. This is the
refine/confirm surface; selecting is NOT select-and-return — the integrator gets the result only
after the user confirms with OK.

Layout (top → bottom):
```
┌────────────────────────────────────────┐
│ ⏏  ⇄        openpicker        ?    ✕   │  header: dock/eject, swap side, help, close
├────────────────────────────────────────┤
│ [ div[data-hveid] > div:nth-of-type(5) ]⚙│  editable selector input + settings
├────────────────────────────────────────┤
│                  div                    │  DOM tree navigator:
│                   ⤊                     │   ⤊ parent
│          div  «  div  »  div            │   « prev sibling | current | next sibling »
│                   ⤋                     │   ⤋ first child
│                 style                   │  (clicking any node re-targets selection)
├────────────────────────────────────────┤
│        ✓ Found 1 element(s)             │  live match count: green=1, warning=0 or >1
├────────────────────────────────────────┤
│  🔍 filter attributes…                  │  search/filter box
│  ┌────────────────────────────────┐    │
│  │ innerText      ""            ✓ │    │  attribute cards: name + (truncated) value
│  │ textContent    .LS80J{…} Show more │    │  right-side checkbox = use as match criterion
│  │ innerHTML      <style>…  Show more │    │
│  │ outerHTML      <div …>   Show more │    │
│  │ class          o3j99 LLD4me …  │    │
│  │ id             LS80J           │    │
│  └────────────────────────────────┘    │
├────────────────────────────────────────┤
│            [ Close ]      [ OK ]        │  footer
└────────────────────────────────────────┘
```

Components (all v1, "full" scope):
1. **Header** — dock/eject control, swap side (left/right), help link, close (cancel)
2. **Editable selector input** — shows the `@medv/finder` output; editing re-runs the match.
   The ⚙️ button opens a **settings popover** (see §5.1f) controlling how the selector is generated.
3. **DOM tree navigator** — walk parent (⤊) / first child (⤋) / prev-next siblings («  »);
   clicking re-targets the highlighted element and regenerates the selector. Mirrors the
   `↑/↓` keyboard walk, exposed as a visual control.
4. **Match count** — `querySelectorAll(sel).length`; green when exactly 1, warning otherwise
5. **Attributes list** — searchable list of the element's props/attributes (`innerText`,
   `topText`, `textContent`, `innerHTML`, `outerHTML`, `class`, `id`, `data-*`, `aria-*`, …).
   Each card shows name + truncated value with "Show more"; a checkbox marks the attribute as
   an **extra match criterion** beyond the CSS selector (e.g. also match on `innerText`).
   (No "Interactions" tab — that was specific to the reference product, not part of openpicker.)
6. **Footer** — `Close` (cancel, return nothing) / `OK` (confirm, return the result to the SDK)

Result returned on OK (shape TBD in PROTOCOL.md) includes at least: the chosen `selector`,
the selected element's tag/text, the checked match criteria, and (optionally) a screenshot.

Rendering: the sidebar lives in the **same Shadow DOM** as the overlay (Tailwind-styled),
`position: fixed`, full viewport height, dockable left/right.

### 5.1f Selector settings popover (the ⚙️ gear)
Opened from the gear next to the selector input. Controls how the selector is generated — these
map onto `@medv/finder` configuration, surfaced as UI.

```
┌──────────────────────────────────┐
│ Mode                          ✕  │
│ ┌──────────┬───────────────────┐ │
│ │  Unique  │       List        │ │  segmented toggle
│ └──────────┴───────────────────┘ │
│                                  │
│ Exclude                          │
│ [ Pattern, e.g. keyword|keyword ]│  regex of id/class names to exclude
│                                  │
│ Subframe (Iframe)                │
│ ( OFF ) Custom Match             │  toggle: resolve elements inside iframes
└──────────────────────────────────┘
```

- **Mode: Unique | List**
  - *Unique* (default): selector matches exactly one element (finder's normal behavior).
  - *List*: selector matches a **group** of similar elements (drop the single-element
    discriminators like `:nth-of-type()`, keep the shared tag/class). Enables "select a class of
    elements" use cases (batch highlight, instrument all buttons, etc.).
- **Exclude**: a regex of id/class names to exclude from generation (e.g. `css-|sc-|jsx-`).
  Layered on top of openpicker's **built-in default blacklist** that already filters hashed
  Tailwind / CSS-in-JS classes; this field lets the user add their own patterns. Maps to
  finder's `className` / `idName` predicates.
- **Subframe (Iframe): Custom Match** (toggle, default off): handle elements inside iframes.
  UI is present in v1, but actual cross-origin iframe resolution is **deferred to v2** (requires
  injecting into child frames — see open decision on iframe support). Same-origin may come first.

### 5.1e On-page aids while a selection is active
- **Highlight box + page dimming** (required) — the single box-shadow technique in §5.3
- **HTML tag tooltip** — a floating card near the element showing its opening tag + attributes
  + text content (e.g. `<svg class="lnXdpd" aria-label="Google" …>` / "No Content"), so the
  user can confirm the right element is targeted
- **Dashed ruler guides** (nice-to-have) — dashed lines extending from the element's edges to
  the viewport edges for alignment; first thing to cut if v1 gets tight

### 5.2 Selector generation algorithm

Use **`@medv/finder`** (MIT) as the underlying selector generator — a dependency, not copied
code. It already handles uniqueness, shortest-path search, and `:nth-of-type` fallback.

Configure and wrap it for our needs:
- Provide an `idName` / `className` / `attr` filter that rejects auto-generated values:
  - Auto-generated ids (`ember123`, long hashes)
  - Hashed Tailwind / CSS-in-JS classes (`css-1a2b3c`, `sc-abcdef`)
- Prefer test attributes (`data-testid` / `data-test` / `data-cy`) via finder's `attr` option
- finder already validates uniqueness internally; we may additionally re-check with
  `querySelectorAll(sel).length === 1` for safety
- (Optional, later) score/return top-N candidates for the user to choose

### 5.3 Rendering / isolation
- Render the overlay in a **Shadow DOM** for two-way isolation (page CSS does not pollute the
  overlay and vice versa)
- Default `pointer-events: none`; switch to `auto` when active
- Position with `getBoundingClientRect()` + `position: fixed`; recompute on scroll/resize via rAF

#### Highlight box technique
A single `position: fixed; pointer-events: none` box does both the highlight and the page dimming
via one box-shadow — no separate mask layer:
```css
.op-highlight {
  position: fixed;
  /* positioned with inset: top right bottom left (see below) */
  border-radius: <copied from target element>;
  box-shadow:
    0 0 4px 0 rgba(26,87,230,0.5),       /* glow outline around the target */
    0 0 0 1000vw rgba(223,234,241,0.6);  /* huge spread dims the rest of the page */
}
```
- Compute the box from the target's `getBoundingClientRect()` into CSS `inset` (top/right/bottom/left),
  copy the target's `border-radius` so the outline hugs rounded corners, and account for page zoom.
- **Prefer `transform`/`opacity` transitions for smoother perf** when sliding the box between
  elements; transitioning `inset` (0.3s) is the documented fallback if transform positioning
  proves awkward.

### 5.4 Animation (restrained)
- Highlight transitions: `transform` + `transition ~150ms`; do **not** transition
  `top/left/width/height`
- Lock moment: ~200ms pulse feedback
- Use only `transform` / `opacity` to keep 60fps

---

## 5b. Screenshot range (v1.x)

The result can include a screenshot, whose range is the caller's choice (design principle §1.1):

```ts
type ScreenshotMode = "none" | "element" | "viewport"   // boolean also accepted: true→"element", false→"none"
op.pick({ screenshot: "element" })
```

| Mode | Behavior |
|---|---|
| `"none"` (default) | No screenshot — zero cost. |
| `"element"` | Crop to the selected element. |
| `"viewport"` | The full visible viewport, uncropped. |

Implementation: browsers have no "screenshot one element" API. `chrome.tabs.captureVisibleTab`
captures the **visible viewport**; for `"element"` we then crop it on a `<canvas>` to the target's
`getBoundingClientRect()` × `devicePixelRatio`.

- Before capturing `"element"`, `scrollIntoView` the target so it's within the viewport (otherwise
  it can't be captured).
- No padding — crop tight to the element.
- If the element is larger than the viewport, only the visible part is captured (a browser limit;
  document it).
- Reserved (not implemented): `"fullpage"` (scroll-and-stitch). The string enum leaves room for it.

---

## 5c. Cross-tab picking (v2): open a URL, pick there, return to the caller

The core v2 capability: a SaaS dashboard lets the user enter a URL, opens it, the user picks an
element (and may edit the selector), clicks OK; focus returns to the dashboard and it receives the
selector (+ optional element screenshot). The target tab stays open (it is not closed) so the user
can keep working in it and a follow-up pick can reuse it (§5e).

### API (same method, one extra param — caller is unaware of the cross-tab mechanics)
```ts
const { selector, screenshot } = await op.pick({
  url: "https://example.com",   // present → cross-tab; absent → pick on the current page (v1)
  screenshot: "element",
})
```
- The SDK call and the returned `PickResult` are identical to local picking; the cross-tab dance
  is internal. `ping` adds capability `"openUrl"` for feature detection.

### Flow
```
dashboard tab (source)                         target tab (the url)
  op.pick({url})
   → source content script → background
        background:
          1. reuse existing target tab if it matches (§5e), else tabs.create({ url })
          2. map source↔target (§5e)            target loads; content script ready
          3. tell target "pick(params)"         → "am I a pick target?" (handshake, not a timer)
                                                 → picker runs: hover → click →
                                                   sidebar (editable selector) → OK
                                                 → result (+ cropped screenshot)
          4. focus source tab  (target stays open)
          5. route result back to source
   ← source content script ← background
  op.pick() resolves with the PickResult
```

### Key decisions
- **Trigger:** `url` param on `pick` (not a separate method).
- **Do NOT close the target tab.** On finish, the extension only **refocuses the source tab** —
  the target tab stays open and is the user's to keep or close. (See §5e: the established
  cross-tab pattern this follows never closes tabs; it only creates/focuses them.)
- **Reuse the target tab when appropriate** (§5e): a second pick may reuse the already-open target
  tab instead of opening another, decided by host/URL (+ optional caller `key`).
- **Consent:** bound to the **source origin** (the dashboard), prompted once (PROTOCOL §7); the URL
  is user-entered and the picker is visible in the foreground tab the whole time.
- **Open as:** a new **tab** (placed next to / after the source tab), not a new window.

### Engineering points
- **Readiness handshake, not a delay:** the target content script announces itself to background
  on load; background checks the map and tells it to start. No `sleep`.
- **User closes the target tab manually:** background listens to `tabs.onRemoved`; if no result was
  received, the source `pick` promise rejects with `cancelled`, and the mapping is cleaned up.
- **Login-walled targets:** fine — it's a real tab; the user can log in there before picking.
- **Permissions:** manifest needs `"tabs"` (create/focus, read windowId) and `host_permissions`
  `<all_urls>` (so `captureVisibleTab` works on the target without a per-tab gesture).

### Security (the part that needs care)
Cross-tab amplifies power: a source origin can open an arbitrary URL and read its DOM — close to
"arbitrary cross-origin read." Mitigations: per-source-origin consent (§6 / PROTOCOL §7); the URL
is user-entered; the picker is visible in a foreground tab; and (recommended) a banner in the
target tab — e.g. "openpicker is selecting an element for dashboard.example.com" — for transparency.

---

## 5d. Source↔target tab mapping, reuse, and continuity (v2.x, designed)

This is the heart of robust cross-tab picking. The architecture follows a proven, production cross-
tab pattern (studied for ideas; **all code is openpicker's own — no third-party code is copied, and
no third-party product name appears anywhere in the repo**). Vendor-specific concerns from that
pattern — injecting a vendor SDK, CSP adaptation, debugger UI, hardcoded origin allowlists — are
deliberately dropped; only the generic "open a tab, pick there, route the result back, survive
navigation" machinery is adopted, with one substitution (see "key" below).

### Background keeps a bidirectional tab map
For background to route a result from the target tab back to the right source tab — in both
directions — it stores two flat keys (rebuilt as code, not copied):

```
op:sourceToTarget:<sourceTabId>  →  targetTabId
op:targetToSource:<targetTabId>  →  { sourceTabId, params, key? }
```
- Flat keys (not one big object) give O(1) lookup from **either** side.
- The tabId is encoded **in the key**, so cleanup can scan keys and drop entries whose tab is gone
  (and `tabs.onRemoved` cleans the matching pair precisely when a tab closes).
- Stored in `chrome.storage.session` (survives the MV3 service-worker being recycled, cleared when
  the browser closes).

### Target tab reuse (the "flow_id" substitution)
When a pick requests a `url` and a target tab is already mapped to this source, decide reuse vs.
open-new the same way the reference pattern does — except the business-identity dimension (its
`flow_id`) is replaced by openpicker-native inputs, since openpicker has no business concepts:

```
reference: different host → new tab; same host but different flow_id → new tab; same host, different pathname → new tab
openpicker: different host → new tab; same host but different `key` → new tab; (optional) different pathname → new tab
```
- `key` is an **optional, caller-supplied** opaque string (e.g. the integrator's own step id).
  openpicker never interprets it — it only compares equality, exactly as the reference compares
  flow_id. This keeps the reuse logic identical while staying business-agnostic and open (§1.1).
- No `key` → fall back to host/URL comparison alone.
- Why caller-supplied, not internal: "is this the same task?" is a business judgment only the
  integrator knows. The reference could read flow_id because it *is* the business; openpicker is a
  tool, so the business identity must come in from the caller.

**One target per source (decided: keep it single).** A source holds exactly one target mapping
(`op:sourceToTarget:<sourceTabId>` is a single value, keyed only by source id). Opening a target
for a different host overwrites it. Consequence: pick google → pick facebook → pick google again
opens a *new* google tab (the google mapping was overwritten by facebook); it does not jump back to
the first google tab. Same-host repeat picks (URL/host unchanged) do reuse and jump back. This
matches the reference pattern (also single-target) and is intentionally simple. A "single source →
many targets (reuse per host/key)" model was considered and **declined** for now.

### Continuity across navigation (sessionStorage marker)
When picking is active in a tab, mark it in that page's `sessionStorage`; the content script checks
the marker on load and re-arms the picker automatically. This rides the browser's `sessionStorage`
rules:
- **same-tab navigation / reload** → marker persists → picker re-arms.
- **same-origin new tab** (`window.open` / `target="_blank"`) → the new tab inherits the marker →
  re-arms automatically.
- **cross-origin new tab** / manually opened tab → no inheritance → not auto-resumed (documented limit).

openpicker's twist over the reference: after re-arming on a new page/tab, the result still has to
reach the original **source** tab. The content script reconnects via background, which looks up the
source from the `targetToSource` map and forwards the result. (The reference didn't need this — its
injected SDK carried its own connection; openpicker has no resident SDK, so it reconnects through
the map.)

### Phasing
1. **Phase 1:** background bidirectional map + reuse decision (host/URL + optional `key`) + refocus-
   source-don't-close. This makes repeated cross-tab picks reuse one target tab correctly.
2. **Phase 2:** sessionStorage continuity so picking survives same-tab navigation and same-origin
   new tabs, with result re-routing back to the source via the map.

---

## 6. Security Model (key open topic)

> This is where an "open API" differs from a hardcoded origin allowlist, and it is the core
> value of the project.

Open decisions:
- Any site can postMessage to launch the picker → need **per-origin first-use consent UI**
  (anti-phishing)
- Do we need an API key / origin registration?
- Do we need a visible indicator of "which sites are currently using the picker"?
- How is consent persisted and revoked?

---

## 7. Open Decisions (by priority)

| # | Decision | Status |
|---|---|---|
| 1 | Tech stack | ✅ Decided (WXT + React + TS + Tailwind) |
| 2 | Protocol envelope & naming | ✅ Drafted in PROTOCOL.md (v1) |
| 3 | Security / consent model | ✅ Drafted in PROTOCOL.md §7 (per-origin consent); details may evolve |
| 4 | Selector generation details | ⏳ |
| 5 | Support elements inside iframes | ⏳ UI toggle in v1; cross-origin resolution deferred to v2 (§5.1f) |
| 6 | Pierce into Shadow DOM elements (v1?) | ⏳ |
| 7 | Post-selection sidebar | ✅ Decided: full inspector panel (§5.1d, §5.1f), not select-and-return |
| 11 | Selector settings popover (Mode Unique/List, Exclude, Iframe) | ✅ Decided (§5.1f) |
| 8 | Support Firefox/Edge from day one (WXT makes this cheap) | ⏳ |
| 9 | Docs site choice | ⏳ |
| 12 | Screenshot range (none/element/viewport) | ✅ Decided (§5b) |
| 13 | Cross-tab picking via `pick({ url })` | ✅ Designed (§5c) — implemented |
| 14 | "Open by parameter" design principle | ✅ Decided (§1.1) |
| 15 | Cross-tab source↔target map, tab reuse (host/URL + optional `key`), sessionStorage continuity | ✅ Designed (§5d); follows a proven cross-tab pattern, own code; not yet implemented |

---

## 8. Edge Cases (handle during implementation)
- `position: fixed` elements outside the viewport
- Elements with `transform: scale()`
- Elements inside same-origin vs cross-origin iframes
- Elements inside a Shadow DOM
- Hidden elements (`display:none` / `visibility:hidden` / `opacity:0`) — selectable or not?
- Tiny (1×1 tracking pixels) and huge (full-screen) elements
- Elements that change shape on hover (`:hover` causing bounding-rect jumps)
