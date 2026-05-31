import { toggleActive, useOverlayState } from "./store"

/**
 * Root overlay rendered inside the content script's Shadow DOM.
 *
 * For this foundation step it renders a small, Tailwind-styled panel when active —
 * proof that React + Tailwind work inside the isolated shadow root (page CSS cannot
 * leak in, and these styles cannot leak out). The real picker UI (highlight box,
 * bottom bar, sidebar) replaces this panel in the next step.
 */
export function Overlay() {
  const { active } = useOverlayState()
  if (!active) return null

  return (
    <div className="fixed bottom-5 left-1/2 z-[2147483646] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-800 px-4 py-3 text-slate-50 shadow-lg">
        <span className="inline-block size-2 rounded-full bg-emerald-400" />
        <span className="text-sm font-medium">openpicker overlay is live</span>
        <button
          type="button"
          onClick={() => toggleActive()}
          className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-600"
        >
          Close
        </button>
      </div>
    </div>
  )
}
