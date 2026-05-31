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

### 5.1b Bottom toolbar (the picker bar)
While the picker is active, show a horizontal control bar (~52px tall). Render it **inside the
same Shadow DOM** as the overlay — no iframe needed.

Layout (left → right):
- A drag/pin control to move the bar between **bottom** and **top** of the viewport
  (so it never covers the element being picked)
- Instruction / status text (e.g. "Hover and click an element to select it")
- Live selector preview (the selector currently under the cursor)
- A **Cancel** button (also `Esc`)
- (Optional, later) a pick/pause toggle to temporarily interact with the page normally

Styling: Tailwind, dark rounded bar, high `z-index`, `position: fixed`, centered horizontally.

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

---

## 8. Edge Cases (handle during implementation)
- `position: fixed` elements outside the viewport
- Elements with `transform: scale()`
- Elements inside same-origin vs cross-origin iframes
- Elements inside a Shadow DOM
- Hidden elements (`display:none` / `visibility:hidden` / `opacity:0`) — selectable or not?
- Tiny (1×1 tracking pixels) and huge (full-screen) elements
- Elements that change shape on hover (`:hover` causing bounding-rect jumps)
