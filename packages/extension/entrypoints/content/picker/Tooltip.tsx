import type { ReactNode } from "react"

interface TooltipProps {
  label: string
  /** Which side of the trigger the tip sits on. */
  side?: "top" | "bottom"
  /** Horizontal anchoring; use "end" near the panel's right edge to avoid overflow. */
  align?: "center" | "end"
  children: ReactNode
}

/**
 * A lightweight, dependency-free tooltip: a styled label that fades in on hover.
 * CSS-only (Tailwind group-hover), so no positioning library or portal is needed —
 * which keeps it simple and safe inside our Shadow DOM. Replaces the slow, easy-to-
 * miss native `title` tooltips on icon-only buttons.
 */
export function Tooltip({ label, side = "bottom", align = "center", children }: TooltipProps) {
  const vertical = side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
  const horizontal = align === "end" ? "right-0" : "-translate-x-1/2 left-1/2"
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 font-medium text-[11px] text-white opacity-0 shadow-md transition-opacity duration-100 group-hover/tt:opacity-100 ${vertical} ${horizontal}`}
      >
        {label}
      </span>
    </span>
  )
}
