import { useMemo } from "react"

interface HighlightBoxProps {
  rect: DOMRect
  /** The highlighted element, read to make the outline hug its rounded corners. */
  el?: Element | null
  /**
   * Ease position/size changes over this many ms as the box moves between
   * elements. 0 (default) disables the transition. Hovering uses a short value so
   * it glides without lagging the cursor; locked re-targeting can be a touch longer.
   */
  glideMs?: number
}

/** Minimum corner radius so even square elements get a subtly softened outline. */
const MIN_RADIUS = 2

/**
 * Read the element's four corner radii and return a CSS `border-radius` shorthand,
 * so the highlight outline follows the shape of rounded buttons / pills / cards.
 * Falls back to a small uniform radius when the element or its style is unavailable.
 */
function cornerRadii(el: Element | null | undefined): string {
  if (!el) return `${MIN_RADIUS}px`
  const s = window.getComputedStyle(el)
  const corner = (v: string) => {
    const n = Number.parseFloat(v)
    return `${Math.max(MIN_RADIUS, Number.isFinite(n) ? n : 0)}px`
  }
  return [
    corner(s.borderTopLeftRadius),
    corner(s.borderTopRightRadius),
    corner(s.borderBottomRightRadius),
    corner(s.borderBottomLeftRadius),
  ].join(" ")
}

/**
 * The highlight + page-dimming box. A single fixed, non-interactive element does
 * both jobs: a glow outline around the target and a huge box-shadow spread that
 * darkens the rest of the page. See DESIGN.md §5.3.
 */
export function HighlightBox({ rect, el, glideMs = 0 }: HighlightBoxProps) {
  const radius = useMemo(() => cornerRadii(el), [el])

  const style = useMemo<React.CSSProperties>(
    () => ({
      position: "fixed",
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      borderRadius: radius,
      boxShadow: "0 0 0 2px rgba(59,130,246,0.9), 0 0 0 100000px rgba(15,23,42,0.45)",
      pointerEvents: "none",
      // Ease only position/size (not the corner radius) so the box glides to the
      // new target. Disabled when glideMs is 0.
      transition: glideMs
        ? `top ${glideMs}ms ease-out, left ${glideMs}ms ease-out, width ${glideMs}ms ease-out, height ${glideMs}ms ease-out`
        : "none",
    }),
    [rect, radius, glideMs],
  )

  return <div style={style} />
}
