import { describe, expect, it } from "vitest"
import {
  attrListToRegex,
  coerceSelectorSettings,
  composeSelectorSettings,
  defaultSelectorSettings,
  resolveInitialSettings,
} from "./selectorSettings"

describe("attrListToRegex", () => {
  it("turns a name list into an anchored alternation", () => {
    expect(attrListToRegex("data-testid, name")).toBe("^(?:data-testid|name)$")
    expect(attrListToRegex("a b|c")).toBe("^(?:a|b|c)$")
  })

  it("returns empty for an empty list", () => {
    expect(attrListToRegex("")).toBe("")
    expect(attrListToRegex("  , |")).toBe("")
  })

  it("produces a regex that matches exactly the listed names", () => {
    const re = new RegExp(attrListToRegex("data-step, name"))
    expect(re.test("data-step")).toBe(true)
    expect(re.test("name")).toBe(true)
    expect(re.test("data-stepx")).toBe(false)
    expect(re.test("surname")).toBe(false)
  })
})

describe("defaultSelectorSettings", () => {
  it("enables every dimension with no filters", () => {
    const s = defaultSelectorSettings()
    for (const dim of ["id", "class", "attr", "tag"] as const) {
      expect(s[dim]).toEqual({ enabled: true, allow: "", ignore: "" })
    }
  })
})

describe("coerceSelectorSettings", () => {
  it("returns null for non-objects", () => {
    expect(coerceSelectorSettings(null)).toBeNull()
    expect(coerceSelectorSettings("x")).toBeNull()
    expect(coerceSelectorSettings({ random: 1 })).toBeNull()
  })

  it("migrates the legacy shape (toggles + ignore regex + attr list)", () => {
    const migrated = coerceSelectorSettings({
      useIds: true,
      useClasses: false,
      useAttrs: true,
      ignoreId: "^ember",
      ignoreClass: "css-",
      attrAllow: "data-testid, name",
    })
    expect(migrated).toEqual({
      id: { enabled: true, allow: "", ignore: "^ember" },
      class: { enabled: false, allow: "", ignore: "css-" },
      attr: { enabled: true, allow: "^(?:data-testid|name)$", ignore: "" },
      tag: { enabled: true, allow: "", ignore: "" },
    })
  })

  it("passes through the current shape", () => {
    const current = defaultSelectorSettings()
    expect(coerceSelectorSettings(current)).toEqual(current)
  })
})

describe("composeSelectorSettings", () => {
  it("returns the base unchanged when there is no override", () => {
    const base = defaultSelectorSettings()
    expect(composeSelectorSettings(base, undefined)).toBe(base)
  })

  it("ANDs enabled — a layer can only turn an anchor off", () => {
    const base = defaultSelectorSettings()
    expect(composeSelectorSettings(base, { tag: { enabled: false } }).tag.enabled).toBe(false)
    // An override can't force an off anchor back on.
    const off = { ...defaultSelectorSettings(), id: { enabled: false, allow: "", ignore: "" } }
    expect(composeSelectorSettings(off, { id: { enabled: true } }).id.enabled).toBe(false)
  })

  it("takes the override's allow when set, else keeps the base", () => {
    const base = defaultSelectorSettings()
    expect(composeSelectorSettings(base, { attr: { allow: "^data-" } }).attr.allow).toBe("^data-")
    expect(composeSelectorSettings(base, { attr: { ignore: "^x" } }).attr.allow).toBe("")
  })

  it("unions ignore — a name skipped by either layer is skipped", () => {
    const base = {
      ...defaultSelectorSettings(),
      id: { enabled: true, allow: "", ignore: "^ember" },
    }
    const composed = composeSelectorSettings(base, { id: { ignore: "^radix" } })
    const re = new RegExp(composed.id.ignore)
    expect(re.test("ember1")).toBe(true)
    expect(re.test("radix-x")).toBe(true)
    expect(re.test("main")).toBe(false)
  })
})

describe("resolveInitialSettings", () => {
  it("prefers per-site, then global, then built-in default", () => {
    const perSite = { ...defaultSelectorSettings(), id: { enabled: false, allow: "", ignore: "" } }
    const global = {
      ...defaultSelectorSettings(),
      class: { enabled: false, allow: "", ignore: "" },
    }
    expect(resolveInitialSettings(perSite, global).id.enabled).toBe(false) // per-site wins
    expect(resolveInitialSettings(null, global).class.enabled).toBe(false) // global when no per-site
    expect(resolveInitialSettings(null, null)).toEqual(defaultSelectorSettings()) // built-in
  })

  it("layers the SDK config on top (only narrows)", () => {
    expect(resolveInitialSettings(null, null, { tag: { enabled: false } }).tag.enabled).toBe(false)
  })
})
