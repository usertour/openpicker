# Cross-tab picking

`pick` is **cross-tab only**: `url` is required. The extension opens that URL in a new tab, the user
picks there, and the selector is routed back to your tab.

## Why cross-tab

A web page can already inspect its *own* DOM, so same-tab picking isn't something an extension needs
to provide. The thing a page **can't** do is ask the user to point at an element on **another tab or
origin** and get the selector back — browsers isolate origins. That cross-tab/cross-origin hop is
exactly what the extension bridges, and the reason `pick` requires a `url`.

(For picking on the page you're already on, use the toolbar — that's the human, same-tab path.)

## The flow

```
your tab (source)                         target tab (params.url)
  op.pick({ url })
   → extension opens the URL  ───────────►  picker runs there
                                            user hovers / clicks / confirms
   selector routed back  ◄───────────────  result
  pick() resolves                          focus returns to your tab
```

- The target tab is **not** closed when the pick finishes — the user (and a later pick) can keep it.
- Focus returns to the source tab on finish.

## Reusing the target tab with `key`

`key` is an opaque string identifying "which task" a pick is for. A follow-up `pick` with the same
`key` reuses the existing target tab instead of opening a new one; with no `key`, reuse is decided by
host/URL alone. It's compared for equality and never interpreted.

## Helpers

- [`isTargetOpen()`](/developers/sdk) — whether the target tab opened by your tab is still open
  (useful for showing "target page is open/closed" state).
- [`activateSelf()`](/developers/sdk) — bring your own tab to the foreground (a page can't focus its
  own background tab; only the extension can, and only the calling tab — never another).
