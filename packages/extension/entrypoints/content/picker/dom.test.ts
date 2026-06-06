// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  collectAttributes,
  contentSummary,
  describeElement,
  getFirstChild,
  getNextSibling,
  getParent,
  getPrevSibling,
  isValidSelector,
  matchesTarget,
  openingTag,
  openingTagParts,
  resolveTarget,
  tagLabel,
} from "./dom"

/** Build a detached element from an HTML string. */
function el(html: string): Element {
  const template = document.createElement("template")
  template.innerHTML = html.trim()
  const node = template.content.firstElementChild
  if (!node) throw new Error(`no element in: ${html}`)
  return node
}

/** querySelector that throws instead of returning null (keeps tests assertion-clean). */
function q(root: ParentNode, selector: string): Element {
  const found = root.querySelector(selector)
  if (!found) throw new Error(`not found: ${selector}`)
  return found
}

describe("tagLabel", () => {
  it("combines tag, id, and up to three classes", () => {
    expect(tagLabel(el('<div id="main" class="card big">'))).toBe("div#main.card.big")
  })

  it("caps classes at three", () => {
    expect(tagLabel(el('<div class="a b c d e">'))).toBe("div.a.b.c")
  })

  it("omits id and class when absent", () => {
    expect(tagLabel(el("<span>"))).toBe("span")
    expect(tagLabel(el('<p id="x">'))).toBe("p#x")
    expect(tagLabel(el('<p class="y">'))).toBe("p.y")
  })
})

describe("openingTag / openingTagParts", () => {
  it("renders the opening tag with attributes", () => {
    expect(openingTag(el('<a href="/x" data-y="z">'))).toBe('<a href="/x" data-y="z">')
    expect(openingTag(el("<br>"))).toBe("<br>")
  })

  it("splits tag name and attribute entries", () => {
    expect(openingTagParts(el('<input type="text" name="q">'))).toEqual({
      tag: "input",
      attrs: [
        { name: "type", value: "text" },
        { name: "name", value: "q" },
      ],
    })
  })
})

describe("contentSummary", () => {
  it("collapses whitespace and trims", () => {
    expect(contentSummary(el("<p>  hello   world \n </p>"))).toBe("hello world")
  })

  it("returns an empty string for no text", () => {
    expect(contentSummary(el("<div></div>"))).toBe("")
  })
})

describe("collectAttributes", () => {
  it("includes synthetic markup props then real attributes", () => {
    const entries = collectAttributes(
      el('<button id="go" class="btn" data-testid="submit">Hi</button>'),
    )
    const names = entries.map((e) => e.name)
    expect(names).toContain("textContent")
    expect(names).toContain("innerHTML")
    expect(names).toContain("outerHTML")
    expect(names).toContain("id")
    expect(names).toContain("class")
    expect(names).toContain("data-testid")
    expect(entries.find((e) => e.name === "id")?.value).toBe("go")
    expect(entries.find((e) => e.name === "data-testid")?.value).toBe("submit")
  })
})

describe("describeElement", () => {
  it("summarizes tag, id, classes, and attributes", () => {
    const result = describeElement(
      el('<button id="go" class="btn primary" data-testid="submit">Click</button>'),
    )
    expect(result.tag).toBe("button")
    expect(result.id).toBe("go")
    expect(result.classes).toEqual(["btn", "primary"])
    expect(result.attributes).toEqual({
      id: "go",
      class: "btn primary",
      "data-testid": "submit",
    })
  })

  it("leaves id and classes undefined when absent", () => {
    const result = describeElement(el("<span>hi</span>"))
    expect(result.tag).toBe("span")
    expect(result.id).toBeUndefined()
    expect(result.classes).toBeUndefined()
    expect(result.attributes).toEqual({})
  })
})

describe("DOM-tree navigation (skipping the picker's own host)", () => {
  it("getParent returns the parent element", () => {
    const ul = el("<ul><li id='a'></li></ul>")
    expect(getParent(q(ul, "#a"))).toBe(ul)
  })

  it("getFirstChild skips the host element", () => {
    const ul = el("<ul><b id='host'></b><li id='a'></li></ul>")
    expect(getFirstChild(ul, q(ul, "#host"))).toBe(q(ul, "#a"))
  })

  it("getNextSibling / getPrevSibling skip the host element", () => {
    const ul = el("<ul><li id='a'></li><b id='host'></b><li id='b'></li></ul>")
    const host = q(ul, "#host")
    expect(getNextSibling(q(ul, "#a"), host)).toBe(q(ul, "#b"))
    expect(getPrevSibling(q(ul, "#b"), host)).toBe(q(ul, "#a"))
  })

  it("returns null at the edges", () => {
    const ul = el("<ul><li id='only'></li></ul>")
    const only = q(ul, "#only")
    const host = el("<b></b>")
    expect(getNextSibling(only, host)).toBeNull()
    expect(getPrevSibling(only, host)).toBeNull()
    expect(getFirstChild(only, host)).toBeNull()
  })
})

describe("resolveTarget (mustMatch snap)", () => {
  it("returns the element unchanged when there is no constraint", () => {
    const node = el("<div><span id='x'></span></div>")
    const span = q(node, "#x")
    expect(resolveTarget(span, undefined)).toBe(span)
    expect(resolveTarget(span, "")).toBe(span)
  })

  it("returns the element itself when it matches", () => {
    const form = el("<form><input id='x'></form>")
    const input = q(form, "#x")
    expect(resolveTarget(input, "input, textarea")).toBe(input)
  })

  it("snaps to the nearest matching ancestor", () => {
    const form = el("<div contenteditable><p><b id='x'>hi</b></p></div>")
    const b = q(form, "#x")
    expect(resolveTarget(b, "[contenteditable]")).toBe(form)
  })

  it("returns null when nothing in the chain matches", () => {
    const node = el("<section><span id='x'></span></section>")
    expect(resolveTarget(q(node, "#x"), "input")).toBeNull()
  })

  it("returns null for a malformed selector", () => {
    const node = el("<div id='x'></div>")
    expect(resolveTarget(node, ":::nope")).toBeNull()
  })
})

describe("matchesTarget (confirm gate)", () => {
  it("is true when unconstrained", () => {
    expect(matchesTarget(el("<div>"), undefined)).toBe(true)
  })

  it("checks the element itself, not ancestors", () => {
    const form = el("<form><div id='x'></div></form>")
    const div = q(form, "#x")
    expect(matchesTarget(div, "form")).toBe(false) // ancestor matches, element doesn't
    expect(matchesTarget(div, "div")).toBe(true)
  })

  it("is false for a malformed selector", () => {
    expect(matchesTarget(el("<div>"), ":::nope")).toBe(false)
  })
})

describe("isValidSelector", () => {
  it("accepts valid selectors", () => {
    expect(isValidSelector("input, textarea, [contenteditable]")).toBe(true)
    expect(isValidSelector("div.card > a[href]")).toBe(true)
  })

  it("rejects malformed selectors", () => {
    expect(isValidSelector(":::nope")).toBe(false)
    expect(isValidSelector("div >>> span")).toBe(false)
  })
})
