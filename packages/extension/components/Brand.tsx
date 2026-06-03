/**
 * Brand lockup, shared by the popup, options page, and picker sidebar so the mark
 * and wordmark stay identical everywhere.
 *
 * The mark is a purpose-drawn "target / picker" glyph (outer ring + four ticks +
 * a solid center dot) whose stroke weight matches the wordmark, so it reads as a
 * designed logo rather than a stock line-icon dropped into a box. It sits in a
 * rounded squircle with a subtle gradient and inset bezel for a crafted, app-icon
 * feel. The wordmark is a two-tone logotype: a lighter "open" + a solid "picker".
 */

export function BrandMark({
  className = "h-7 w-7",
  glyph = 16,
}: {
  className?: string
  glyph?: number
}) {
  return (
    <span
      // bg-slate-900 is a solid fallback under the gradient: inside the picker's
      // shadow DOM, Tailwind v4 gradient/ring custom-props can fail to resolve, and
      // without it the white glyph would sit on a transparent (invisible) square.
      className={`grid shrink-0 place-items-center rounded-xl bg-slate-900 bg-gradient-to-b from-slate-700 to-slate-900 text-white shadow-sm ring-1 ring-white/10 ring-inset ${className}`}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <title>openpicker</title>
        <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    </span>
  )
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      <span className="text-slate-400">open</span>
      <span className="text-slate-900">picker</span>
    </span>
  )
}
