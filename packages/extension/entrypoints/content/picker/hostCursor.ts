/**
 * Force a pointer cursor on the host page while picking.
 *
 * This is the one rule that must live on the HOST page rather than in the picker's
 * Shadow DOM: it targets the host's own elements (`body.openpicker-active *`), which
 * shadow-scoped CSS cannot reach. We inject a tiny <style> (just the cursor) into
 * the host <head> and remove it when picking ends — no other styles leak out.
 */

const STYLE_ID = "openpicker-cursor-style"
const BODY_CLASS = "openpicker-active"

const CSS = `
body.${BODY_CLASS}, body.${BODY_CLASS} * { cursor: pointer !important; }
`

/** Apply the host pointer cursor for the duration of a pick. */
export function applyHostCursor(): void {
  document.body.classList.add(BODY_CLASS)
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = CSS
  ;(document.head ?? document.documentElement).appendChild(style)
}

/** Remove the host pointer cursor when the pick ends. */
export function clearHostCursor(): void {
  document.body.classList.remove(BODY_CLASS)
  document.getElementById(STYLE_ID)?.remove()
}
