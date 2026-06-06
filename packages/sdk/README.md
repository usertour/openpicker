# @openpicker/sdk

SDK for invoking the [openpicker](https://openpicker.dev) browser extension to pick a CSS selector
on any page. Website: [openpicker.dev](https://openpicker.dev) · Docs:
[docs.openpicker.dev](https://docs.openpicker.dev) · Live demo:
[demo.openpicker.dev](https://demo.openpicker.dev)

```bash
npm install @openpicker/sdk
```

```ts
import { createOpenpicker, OpenpickerError } from "@openpicker/sdk"

const op = createOpenpicker({ appName: "My App" })

if (await op.isAvailable()) {
  // `url` is required: the extension opens it in a tab, the user picks there,
  // and the selector is routed back here.
  const { selector, matchCount, element } = await op.pick({
    url: "https://app.example.com",
    screenshot: "element", // optional: "none" | "element" | "viewport"
  })
  console.log(selector, matchCount, element)
} else {
  // Prompt the user to install the openpicker extension.
}
```

## Constrain the selector

Pass per-dimension rules into a pick (id / class / attribute / tag, each with an `allow` and an
`ignore` regex), lock the picker UI so the user can't loosen them, and/or require a unique match:

```ts
const { selector } = await op.pick({
  url: "https://app.example.com",
  selector: {
    attr: { allow: "^data-step$" }, // only the data-step attribute
    id: { enabled: false },
    class: { enabled: false },
    tag: { enabled: false },
  },
  lockSelectorSettings: true, // rule settings shown read-only
  lockSelectorEdit: true, // selector field read-only
  requireUniqueMatch: true, // confirm only when exactly one element matches
})
```

SDK rules compose with the user's own saved rules — each layer can only narrow. Since the user can
still hand-edit the selector unless you set `lockSelectorEdit`, validate the result against your
config with `matchesSelectorConfig`:

```ts
import { matchesSelectorConfig } from "@openpicker/sdk"

const config = { attr: { allow: "^data-step$" }, tag: { enabled: false } }
const { selector } = await op.pick({ url, selector: config })
if (!matchesSelectorConfig(selector, config)) {
  // doesn't meet your requirement — ask the user to pick again
}
```

See [Configuring selectors](https://docs.openpicker.dev/guide/configuring-selectors) for the full
model.

## More

See the [protocol spec](https://github.com/usertour/openpicker/blob/main/PROTOCOL.md) for the
wire format, and the [main README](https://github.com/usertour/openpicker) for the full API.
