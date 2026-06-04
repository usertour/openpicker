/**
 * Shared test setup. jsdom does not implement `CSS.escape`, but the picker's
 * selector code (and @medv/finder) rely on it the way a real browser provides it.
 * Polyfill it for the test environment so selector generation behaves faithfully.
 * (Spec algorithm, per https://drafts.csswg.org/cssom/#serialize-an-identifier.)
 */

function cssEscape(value: string): string {
  const text = String(value)
  const length = text.length
  const firstCodeUnit = text.charCodeAt(0)
  let result = ""
  for (let index = 0; index < length; index++) {
    const codeUnit = text.charCodeAt(index)

    // Replace NULL with the replacement character.
    if (codeUnit === 0x0000) {
      result += "�"
      continue
    }

    // Control chars, a leading digit, or a digit after a leading hyphen → escape as hex.
    if (
      (codeUnit >= 0x0001 && codeUnit <= 0x001f) ||
      codeUnit === 0x007f ||
      (index === 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
      (index === 1 && codeUnit >= 0x0030 && codeUnit <= 0x0039 && firstCodeUnit === 0x002d)
    ) {
      result += `\\${codeUnit.toString(16)} `
      continue
    }

    // A single leading hyphen must be escaped.
    if (index === 0 && length === 1 && codeUnit === 0x002d) {
      result += `\\${text.charAt(index)}`
      continue
    }

    // Identifier-safe characters pass through unescaped.
    if (
      codeUnit >= 0x0080 ||
      codeUnit === 0x002d ||
      codeUnit === 0x005f ||
      (codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
      (codeUnit >= 0x0041 && codeUnit <= 0x005a) ||
      (codeUnit >= 0x0061 && codeUnit <= 0x007a)
    ) {
      result += text.charAt(index)
      continue
    }

    // Everything else is backslash-escaped.
    result += `\\${text.charAt(index)}`
  }
  return result
}

const cssNamespace = (globalThis as { CSS?: { escape?: (value: string) => string } }).CSS ?? {}
if (typeof cssNamespace.escape !== "function") {
  cssNamespace.escape = cssEscape
  ;(globalThis as { CSS?: unknown }).CSS = cssNamespace
}
