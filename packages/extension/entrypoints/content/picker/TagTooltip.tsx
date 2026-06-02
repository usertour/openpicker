import { contentSummary, openingTagParts } from "./dom"

interface TagTooltipProps {
  el: Element
  rect: DOMRect
}

const MAX_VALUE = 160
const MAX_CONTENT = 200

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

/**
 * A floating card shown next to the element while hovering, so the user can verify
 * the exact element before clicking: the full opening tag — name, every attribute
 * on its own line (syntax-highlighted), and a content summary. Once an element is
 * locked this is gone; the sidebar carries the details. See DESIGN.md §5.1e.
 */
export function TagTooltip({ el, rect }: TagTooltipProps) {
  const { tag, attrs } = openingTagParts(el)
  const content = contentSummary(el)

  // Anchor the card to the element, below it; flip above if it would overflow.
  const cardWidth = 420
  const belowSpace = window.innerHeight - rect.bottom
  const placeBelow = belowSpace > 160 || belowSpace > rect.top
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, Math.min(rect.left, window.innerWidth - cardWidth - 8)),
    top: placeBelow ? rect.bottom + 8 : undefined,
    bottom: placeBelow ? undefined : window.innerHeight - rect.top + 8,
    maxWidth: cardWidth,
    pointerEvents: "none",
    zIndex: 1,
  }

  return (
    <div style={style}>
      <div
        className="overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed shadow-lg"
        style={{ maxHeight: "50vh" }}
      >
        <div className="text-slate-400">
          &lt;<span className="text-rose-600">{tag}</span>
          {attrs.length === 0 && <span>&gt;</span>}
        </div>
        {attrs.map((a, i) => (
          <div key={`${a.name}-${i}`} className="pl-3">
            <span className="text-sky-700">{a.name}</span>
            <span className="text-slate-400">=</span>
            <span className="break-all text-amber-700">"{truncate(a.value, MAX_VALUE)}"</span>
            {i === attrs.length - 1 && <span className="text-slate-400">&gt;</span>}
          </div>
        ))}
        <div className="mt-1.5 border-slate-100 border-t pt-1.5 text-slate-500">
          {content ? (
            truncate(content, MAX_CONTENT)
          ) : (
            <span className="text-slate-400 italic">No Content</span>
          )}
        </div>
      </div>
    </div>
  )
}
