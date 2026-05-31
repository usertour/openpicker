import { openingTag } from "./dom"

interface TagTooltipProps {
  el: Element
  rect: DOMRect
}

/**
 * A floating card near the target showing its opening tag, so the user can
 * confirm the right element is targeted. See DESIGN.md §5.1e.
 */
export function TagTooltip({ el, rect }: TagTooltipProps) {
  const below = rect.top < 28
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(4, Math.min(rect.left, window.innerWidth - 320)),
    top: below ? rect.bottom + 4 : rect.top - 24,
    maxWidth: 320,
    pointerEvents: "none",
  }
  return (
    <div style={style}>
      <code className="inline-block max-w-full truncate rounded bg-slate-900/95 px-2 py-1 font-mono text-[11px] text-emerald-300 shadow">
        {openingTag(el)}
      </code>
    </div>
  )
}
