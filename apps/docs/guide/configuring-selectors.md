# Configuring selectors

Different sites have different conventions — one relies on `data-testid`, another on stable ids or
class names. openpicker lets you control **how selectors are built**, and remembers it **per site**.

Open the settings from the **gear** button in the sidebar header (visible once an element is
selected).

## What you can control

Each part of an element can be enabled or disabled as a selector anchor:

| Setting | What it does |
| --- | --- |
| **Enable ID** | Allow the element's `id` in the selector. |
| **Enable Class** | Allow the element's class names. |
| **Enable Attribute** | Allow attributes (test hooks, `name`, `aria-label`, etc.). |

Each has its own filter box:

- **Ignore id pattern** — a regular expression of id names to skip. Example: `^ember|^radix-`
  to ignore auto-generated framework ids.
- **Ignore class pattern** — a regex of class names to skip. Example: `css-|sc-|jsx-` to ignore
  hashed CSS-in-JS / CSS-module classes.
- **Attributes to use** — a list of attribute names to use. Example: `data-testid, name`. Leave it
  empty for the automatic default set (see below).

## Attribute defaults

When the attribute allow-list is empty, openpicker uses a sensible default: common test hooks
(`data-testid`, `data-cy`, …) plus a curated set of stable attributes (`name`, `aria-label`,
`role`, `rel`, `href`, and word-like `data-*`) — and only when their values look stable (not random).

Type names into the box to restrict it to exactly those attributes (any value).

## Built-in stability filters

Even with everything enabled, openpicker automatically avoids anchors that won't survive a redeploy:
auto-generated ids (Ember, Radix, React `useId`, long hex hashes) and hashed class names (Emotion,
styled-components, CSS modules). Your ignore patterns are layered on top of these.

## Remembered per site

Your settings are saved per origin (e.g. `https://app.example.com`) in the browser, so each site
keeps its own conventions. Nothing is sent anywhere.

## SDK override

When a pick is started via the SDK with an [`exclude`](/developers/sdk) regex, that pattern takes
priority over the saved ignore patterns for that pick.
