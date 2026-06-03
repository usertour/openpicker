import { useId } from "react"

/**
 * Brand lockup, shared by the popup, options page, and picker sidebar so the mark
 * and wordmark stay identical everywhere.
 *
 * BrandMark renders the full app icon inline (the same artwork as assets/icon.svg
 * and public/icon/*.png): a crosshair-target "picker" glyph on a dark squircle with
 * a gradient and inset bezel. Baking the tile into the SVG — rather than styling a
 * <span> with Tailwind — keeps it pixel-identical to the toolbar icon and makes it
 * robust inside the picker's shadow DOM, where Tailwind v4 gradient/ring custom-props
 * can fail to resolve. The wordmark is a solid logotype set in semibold.
 */

export function BrandMark({ className = "h-7 w-7" }: { className?: string }) {
  // Unique gradient id per instance so multiple marks on one page don't collide.
  const fill = useId()
  return (
    <svg viewBox="0 0 128 128" className={`shrink-0 ${className}`} aria-hidden="true">
      <title>openpicker</title>
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#334155" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="116" height="116" rx="30" fill={`url(#${fill})`} />
      <rect
        x="7"
        y="7"
        width="114"
        height="114"
        rx="29"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.1"
        strokeWidth="2"
      />
      <g fill="none" stroke="#ffffff" strokeWidth="11" strokeLinecap="round">
        <circle cx="64" cy="64" r="34" />
        <path d="M64 12 V30 M64 98 V116 M12 64 H30 M98 64 H116" />
      </g>
      <circle cx="64" cy="64" r="11" fill="#ffffff" />
    </svg>
  )
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-semibold text-slate-900 tracking-tight ${className}`}>openpicker</span>
}

/** One-line description shown under the wordmark; reused across the logo lockups. */
export const BRAND_TAGLINE = "Pick an element, get its selector"

/**
 * The full logo lockup (mark + wordmark, with an optional tagline beneath). Used by
 * the popup and options header so the brand area stays consistent and well-filled.
 */
export function BrandLockup({
  markClass = "h-8 w-8",
  nameClass = "text-base",
  tagline = false,
  className = "",
}: {
  markClass?: string
  nameClass?: string
  tagline?: boolean
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark className={markClass} />
      <div className="leading-tight">
        <Wordmark className={nameClass} />
        {tagline && <div className="text-[11px] text-slate-400 leading-tight">{BRAND_TAGLINE}</div>}
      </div>
    </div>
  )
}
