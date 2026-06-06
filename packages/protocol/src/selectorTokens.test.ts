import { describe, expect, it } from "vitest"
import type { SelectorConfig } from "./methods"
import { matchesSelectorConfig, type SelectorTokenType, tokenizeSelector } from "./selectorTokens"

const shape = (sel: string): string[] => tokenizeSelector(sel).map((t) => `${t.text}:${t.type}`)
const typesOf = (sel: string, text: string): SelectorTokenType[] =>
  tokenizeSelector(sel)
    .filter((t) => t.text === text)
    .map((t) => t.type)

describe("tokenizeSelector", () => {
  it("returns nothing for an empty selector", () => {
    expect(tokenizeSelector("")).toEqual([])
  })

  it("preserves the exact input when concatenated", () => {
    const samples = [
      "div",
      "#main",
      ".card.is-active",
      'nav > .toolbar button[data-testid="submit"]',
      "ul li:nth-child(2n + 1)",
      "a[href^='https']:hover",
      "section .row   >   span",
      "*",
      "::before",
      "input[type=checkbox]:checked + label",
    ]
    for (const s of samples) {
      expect(
        tokenizeSelector(s)
          .map((t) => t.text)
          .join(""),
      ).toBe(s)
    }
  })

  it("classifies the basic anchor types", () => {
    expect(typesOf("button", "button")).toEqual(["tag"])
    expect(typesOf("#main", "#main")).toEqual(["id"])
    expect(typesOf(".card", ".card")).toEqual(["class"])
    expect(typesOf("*", "*")).toEqual(["tag"])
  })

  it("treats combinators (>, +, ~, descendant space) as combinator tokens", () => {
    expect(typesOf("a > b", ">")).toEqual(["combinator"])
    expect(typesOf("a + b", "+")).toEqual(["combinator"])
    expect(typesOf("a ~ b", "~")).toEqual(["combinator"])
    expect(tokenizeSelector("a b").some((t) => t.type === "combinator" && /\s/.test(t.text))).toBe(
      true,
    )
  })

  it("splits attribute selectors into name and value", () => {
    expect(shape('[data-testid="submit"]')).toEqual([
      "[:punctuation",
      "data-testid:attrName",
      "=:punctuation",
      '"submit":attrValue',
      "]:punctuation",
    ])
  })

  it("treats pseudo-classes (incl. functional) as a single pseudo token", () => {
    expect(typesOf("a:hover", ":hover")).toEqual(["pseudo"])
    expect(typesOf("li:nth-child(2n+1)", ":nth-child(2n+1)")).toEqual(["pseudo"])
    expect(typesOf("p::before", "::before")).toEqual(["pseudo"])
  })
})

describe("matchesSelectorConfig", () => {
  const onlyDataStep: SelectorConfig = {
    id: { enabled: false },
    class: { enabled: false },
    tag: { enabled: false },
    attr: { allow: "^data-step$" },
  }

  it("accepts a selector that uses only allowed anchors", () => {
    expect(matchesSelectorConfig('[data-step="x"]', onlyDataStep)).toBe(true)
  })

  it("rejects selectors that use disabled dimensions", () => {
    expect(matchesSelectorConfig("div[data-step]", onlyDataStep)).toBe(false) // tag disabled
    expect(matchesSelectorConfig("#main", onlyDataStep)).toBe(false) // id disabled
    expect(matchesSelectorConfig(".foo", onlyDataStep)).toBe(false) // class disabled
  })

  it("rejects an attribute name outside the allow regex", () => {
    expect(matchesSelectorConfig('[data-other="y"]', onlyDataStep)).toBe(false)
  })

  it("treats a missing dimension as unconstrained", () => {
    expect(matchesSelectorConfig("div#a.b[c]", {})).toBe(true)
    expect(matchesSelectorConfig("a:hover > span", {})).toBe(true)
  })

  it("honors an ignore regex", () => {
    expect(matchesSelectorConfig("#ember123", { id: { ignore: "^ember" } })).toBe(false)
    expect(matchesSelectorConfig("#main", { id: { ignore: "^ember" } })).toBe(true)
  })

  it("does not constrain the universal selector", () => {
    expect(matchesSelectorConfig("*", { tag: { enabled: false } })).toBe(true)
  })
})
