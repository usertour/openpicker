import { useMemo } from "react"

interface HighlightBoxProps {
  rect: DOMRect
  /** Copy the target's border radius so the outline hugs rounded corners. */
  borderRadius?: string
  /** Smoothly animate between elements (used once a target is locked). */
  animated?: boolean
}

/**
 * The highlight + page-dimming box. A single fixed, non-interactive element does
 * both jobs: a glow outline around the target and a huge box-shadow spread that
 * darkens the rest of the page. See DESIGN.md §5.3.
 */
export function HighlightBox({ rect, borderRadius, animated }: HighlightBoxProps) {
  const style = useMemo<React.CSSProperties>(
    () => ({
      position: "fixed",
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      borderRadius: borderRadius ?? "2px",
      boxShadow:
        "0 0 0 2px rgba(59,130,246,0.9), 0 0 0 100000px rgba(15,23,42,0.45)",
      pointerEvents: "none",
      transition: animated ? "all 120ms cubic-bezier(0.25,0.8,0.5,1)" : "none",
    }),
    [rect, borderRadius, animated],
  )
  return <div style={style} />
}
