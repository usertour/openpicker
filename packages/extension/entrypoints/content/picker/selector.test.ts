// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { AUTO_ATTRS, evalSelector, generateSelector, isStableClass, isStableId } from "./selector"

function q(root: ParentNode, selector: string): Element {
  const found = root.querySelector(selector)
  if (!found) throw new Error(`not found: ${selector}`)
  return found
}

describe("isStableId", () => {
  it("accepts human-readable ids", () => {
    expect(isStableId("main-header", null)).toBe(true)
    expect(isStableId("nav", null)).toBe(true)
  })

  it("rejects auto-generated ids", () => {
    expect(isStableId("ember123", null)).toBe(false) // Ember
    expect(isStableId("radix-:r1:", null)).toBe(false) // Radix
    expect(isStableId("react-aria1", null)).toBe(false) // React Aria
    expect(isStableId("headlessui-menu-1", null)).toBe(false) // Headless UI
    expect(isStableId(":r0:", null)).toBe(false) // React useId
    expect(isStableId("a1b2c3d4", null)).toBe(false) // long hex hash
  })

  it("rejects empty and honors the user exclude regex", () => {
    expect(isStableId("", null)).toBe(false)
    expect(isStableId("keep-this", /^keep/)).toBe(false)
    expect(isStableId("other", /^keep/)).toBe(true)
  })
})

describe("isStableClass", () => {
  it("accepts human-readable class names", () => {
    expect(isStableClass("card", null)).toBe(true)
    expect(isStableClass("nav-bar", null)).toBe(true)
  })

  it("rejects hashed CSS-in-JS / CSS-module class names", () => {
    expect(isStableClass("css-1a2b3c", null)).toBe(false) // emotion
    expect(isStableClass("sc-AbCdEf", null)).toBe(false) // styled-components
    expect(isStableClass("emotion-7", null)).toBe(false)
  })

  it("rejects empty and honors the user exclude regex", () => {
    expect(isStableClass("", null)).toBe(false)
    expect(isStableClass("col-12", /^col-/)).toBe(false)
    expect(isStableClass("button", /^col-/)).toBe(true)
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
  const allOn = { useIds: true, useClasses: true, useAttrs: true }

  it("produces a selector that uniquely identifies the element", () => {
    document.body.innerHTML = '<div id="wrap"><button id="save" class="btn">Save</button></div>'
    const button = q(document, "#save")
    const selector = generateSelector(button, allOn)
    expect(document.querySelectorAll(selector)).toHaveLength(1)
    expect(document.querySelector(selector)).toBe(button)
  })

  it("does not anchor on an auto-generated id, but still resolves uniquely", () => {
    document.body.innerHTML = '<section><a id="ember123" class="link">x</a></section>'
    const link = q(document, "#ember123")
    const selector = generateSelector(link, allOn)
    expect(selector).not.toContain("#ember123")
    expect(document.querySelector(selector)).toBe(link)
  })

  it("avoids ids entirely when useIds is false", () => {
    document.body.innerHTML = '<div><span id="here" class="tag">x</span></div>'
    const span = q(document, "#here")
    const selector = generateSelector(span, { useIds: false, useClasses: true, useAttrs: true })
    expect(selector).not.toContain("#here")
    expect(document.querySelector(selector)).toBe(span)
  })
})

describe("AUTO_ATTRS", () => {
  it("advertises the default anchor attributes shown in settings", () => {
    expect(AUTO_ATTRS).toContain("data-testid")
    expect(AUTO_ATTRS).toContain("aria-label")
    expect(Array.isArray(AUTO_ATTRS)).toBe(true)
  })
})
