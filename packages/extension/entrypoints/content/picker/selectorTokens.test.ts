import { describe, expect, it } from "vitest"
import { type SelectorTokenType, tokenizeSelector } from "./selectorTokens"

/** Collapse tokens to "text:type" pairs for compact assertions. */
const shape = (sel: string): string[] => tokenizeSelector(sel).map((t) => `${t.text}:${t.type}`)
const typesOf = (sel: string, text: string): SelectorTokenType[] =>
  tokenizeSelector(sel)
    .filter((t) => t.text === text)
    .map((t) => t.type)

describe("tokenizeSelector", () => {
  it("returns nothing for an empty selector", () => {
    expect(tokenizeSelector("")).toEqual([])
  })

  it("preserves the exact input when concatenated (no dropped/added chars)", () => {
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
    // A plain descendant space is its own combinator token.
    expect(tokenizeSelector("a b").some((t) => t.type === "combinator" && /\s/.test(t.text))).toBe(
      true,
    )
  })

  it("sub-tokenizes attribute selectors: brackets/operators punctuation, name+value attr", () => {
    expect(shape('[data-testid="submit"]')).toEqual([
      "[:punctuation",
      "data-testid:attr",
      "=:punctuation",
      '"submit":attr',
      "]:punctuation",
    ])
  })

  it("treats pseudo-classes (incl. functional) as a single pseudo token", () => {
    expect(typesOf("a:hover", ":hover")).toEqual(["pseudo"])
    expect(typesOf("li:nth-child(2n+1)", ":nth-child(2n+1)")).toEqual(["pseudo"])
    expect(typesOf("p::before", "::before")).toEqual(["pseudo"])
  })

  it("handles a realistic compound selector end to end", () => {
    const toks = tokenizeSelector('nav > .toolbar button[data-testid="submit"]')
    expect(toks.map((t) => t.text).join("")).toBe('nav > .toolbar button[data-testid="submit"]')
    expect(typesOf('nav > .toolbar button[data-testid="submit"]', "nav")).toEqual(["tag"])
    expect(typesOf('nav > .toolbar button[data-testid="submit"]', ".toolbar")).toEqual(["class"])
    expect(typesOf('nav > .toolbar button[data-testid="submit"]', "button")).toEqual(["tag"])
  })
})
