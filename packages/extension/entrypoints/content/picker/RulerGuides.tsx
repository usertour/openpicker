interface RulerGuidesProps {
  rect: DOMRect
}

const LINE = "rgba(147,51,234,0.5)"

/**
 * Dashed alignment guides extending from each edge of the target to the viewport
 * edges. Purely visual; non-interactive. See DESIGN.md §5.1e.
 */
export function RulerGuides({ rect }: RulerGuidesProps) {
  const h: React.CSSProperties = {
    position: "fixed",
    left: 0,
    right: 0,
    height: 0,
    borderTop: `1px dashed ${LINE}`,
    pointerEvents: "none",
  }
  const v: React.CSSProperties = {
    position: "fixed",
    top: 0,
    bottom: 0,
    width: 0,
    borderLeft: `1px dashed ${LINE}`,
    pointerEvents: "none",
  }
  return (
    <>
      <div style={{ ...h, top: rect.top }} />
      <div style={{ ...h, top: rect.bottom }} />
      <div style={{ ...v, left: rect.left }} />
      <div style={{ ...v, left: rect.right }} />
    </>
  )
}
