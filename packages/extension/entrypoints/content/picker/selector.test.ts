// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { AUTO_ATTRS, evalSelector, generateSelector, isStableClass, isStableId } from "./selector"
import { defaultSelectorSettings, type SelectorSettings } from "./selectorSettings"

function q(root: ParentNode, selector: string): Element {
  const found = root.querySelector(selector)
  if (!found) throw new Error(`not found: ${selector}`)
  return found
}

describe("isStableId", () => {
  it("accepts human-readable ids", () => {
    expect(isStableId("main-header")).toBe(true)
    expect(isStableId("nav")).toBe(true)
  })

  it("rejects auto-generated ids", () => {
    expect(isStableId("ember123")).toBe(false) // Ember
    expect(isStableId("radix-:r1:")).toBe(false) // Radix
    expect(isStableId("react-aria1")).toBe(false) // React Aria
    expect(isStableId("headlessui-menu-1")).toBe(false) // Headless UI
    expect(isStableId(":r0:")).toBe(false) // React useId
    expect(isStableId("a1b2c3d4")).toBe(false) // long hex hash
  })

  it("rejects the empty string", () => {
    expect(isStableId("")).toBe(false)
  })
})

describe("isStableClass", () => {
  it("accepts human-readable class names", () => {
    expect(isStableClass("card")).toBe(true)
    expect(isStableClass("nav-bar")).toBe(true)
  })

  it("rejects hashed CSS-in-JS / CSS-module class names", () => {
    expect(isStableClass("css-1a2b3c")).toBe(false) // emotion
    expect(isStableClass("sc-AbCdEf")).toBe(false) // styled-components
    expect(isStableClass("emotion-7")).toBe(false)
  })

  it("rejects the empty string", () => {
    expect(isStableClass("")).toBe(false)
  })
})

describe("evalSelector", () => {
  it("treats blank selectors as valid with zero matches", () => {
    expect(evalSelector("")).toEqual({ valid: true, count: 0 })
    expect(evalSelector("   ")).toEqual({ valid: true, count: 0 })
  })

  it("counts matches for a valid selector", () => {
    document.body.innerHTML = '<div class="x"></div><div class="x"></div><p id="only"></p>'
    expect(evalSelector(".x")).toEqual({ valid: true, count: 2 })
    expect(evalSelector("#only")).toEqual({ valid: true, count: 1 })
    expect(evalSelector(".nope")).toEqual({ valid: true, count: 0 })
  })

  it("flags an invalid selector instead of counting it as zero matches", () => {
    expect(evalSelector("a[")).toEqual({ valid: false, count: 0 })
  })
})

describe("generateSelector", () => {
  function withDisabled(dim: keyof SelectorSettings): SelectorSettings {
    return { ...defaultSelectorSettings(), [dim]: { enabled: false, allow: "", ignore: "" } }
  }

  it("produces a selector that uniquely identifies the element", () => {
    document.body.innerHTML = '<div id="wrap"><button id="save" class="btn">Save</button></div>'
    const button = q(document, "#save")
    const selector = generateSelector(button, defaultSelectorSettings())
    expect(document.querySelectorAll(selector)).toHaveLength(1)
    expect(document.querySelector(selector)).toBe(button)
  })

  it("does not anchor on an auto-generated id, but still resolves uniquely", () => {
    document.body.innerHTML = '<section><a id="ember123" class="link">x</a></section>'
    const link = q(document, "#ember123")
    const selector = generateSelector(link, defaultSelectorSettings())
    expect(selector).not.toContain("#ember123")
    expect(document.querySelector(selector)).toBe(link)
  })

  it("avoids ids entirely when the id anchor is disabled", () => {
    document.body.innerHTML = '<div><span id="here" class="tag">x</span></div>'
    const span = q(document, "#here")
    const selector = generateSelector(span, withDisabled("id"))
    expect(selector).not.toContain("#here")
    expect(document.querySelector(selector)).toBe(span)
  })

  it("honors an attribute allow regex", () => {
    document.body.innerHTML = '<div><button data-testid="save" class="btn">x</button></div>'
    const button = q(document, "[data-testid='save']")
    const settings: SelectorSettings = {
      id: { enabled: false, allow: "", ignore: "" },
      class: { enabled: false, allow: "", ignore: "" },
      tag: { enabled: false, allow: "", ignore: "" },
      attr: { enabled: true, allow: "^data-testid$", ignore: "" },
    }
    const selector = generateSelector(button, settings)
    expect(selector).toContain("data-testid")
    expect(document.querySelector(selector)).toBe(button)
  })

  it("honors an ignore regex (avoids the ignored id)", () => {
    document.body.innerHTML = '<div><button id="keepme" class="btn">x</button></div>'
    const button = q(document, "#keepme")
    const settings: SelectorSettings = {
      ...defaultSelectorSettings(),
      id: { enabled: true, allow: "", ignore: "^keep" },
    }
    const selector = generateSelector(button, settings)
    expect(selector).not.toContain("#keepme")
    expect(document.querySelector(selector)).toBe(button)
  })
})

describe("AUTO_ATTRS", () => {
  it("advertises the default anchor attributes shown in settings", () => {
    expect(AUTO_ATTRS).toContain("data-testid")
    expect(AUTO_ATTRS).toContain("aria-label")
    expect(Array.isArray(AUTO_ATTRS)).toBe(true)
  })
})
