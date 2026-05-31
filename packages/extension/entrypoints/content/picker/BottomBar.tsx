interface BottomBarProps {
  /** The selector currently under the cursor, for live preview. */
  preview: string | null
  pinTop: boolean
  onTogglePin: () => void
  onCancel: () => void
}

/**
 * The horizontal control bar shown while hovering for an element to pick.
 * Pin toggles whether it sits at the top or bottom of the viewport so it never
 * covers the element being picked. See DESIGN.md §5.1b.
 */
export function BottomBar({ preview, pinTop, onTogglePin, onCancel }: BottomBarProps) {
  return (
    <div
      className={`fixed left-1/2 z-[2147483646] flex h-13 w-[min(680px,90vw)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-800 px-4 text-slate-50 shadow-2xl ${
        pinTop ? "top-2.5" : "bottom-2.5"
      }`}
    >
      <button
        type="button"
        title={pinTop ? "Move to bottom" : "Move to top"}
        onClick={onTogglePin}
        className="shrink-0 rounded-lg bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
      >
        {pinTop ? "▼" : "▲"}
      </button>
      <span className="shrink-0 text-sm font-medium">Hover and click an element</span>
      <code className="min-w-0 flex-1 truncate rounded bg-slate-900 px-2 py-1 font-mono text-xs text-emerald-300">
        {preview ?? "—"}
      </code>
      <button
        type="button"
        onClick={onCancel}
        title="Cancel (Esc)"
        className="shrink-0 rounded-lg bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-600"
      >
        Cancel
      </button>
    </div>
  )
}
