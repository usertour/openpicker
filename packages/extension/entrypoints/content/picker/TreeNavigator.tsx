import {
  RiArrowDownDoubleLine,
  RiArrowLeftDoubleLine,
  RiArrowRightDoubleLine,
  RiArrowUpDoubleLine,
} from "@remixicon/react"
import { Tooltip } from "./Tooltip"

interface TreeNavigatorProps {
  parentLabel: string | null
  prevLabel: string | null
  currentLabel: string
  nextLabel: string | null
  childLabel: string | null
  onParent: () => void
  onPrev: () => void
  onNext: () => void
  onChild: () => void
  /** Scroll the current element into view. */
  onCenter: () => void
}

const arrowBtn =
  "grid h-7 w-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-slate-700 hover:shadow-sm disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:hover:shadow-none dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-100 dark:disabled:hover:text-slate-500"
const info = "max-w-[12rem] truncate px-1 font-mono text-[11px]"

/**
 * DOM-tree navigator. Only the arrows are clickable (double chevrons): up = parent,
 * down = first child, left/right = previous/next sibling. The parent and child rows
 * are non-clickable labels (parent tinted to mark direction); clicking the current
 * node chip scrolls it into view. See DESIGN.md §5.1d.
 */
export function TreeNavigator(props: TreeNavigatorProps) {
  return (
    <div className="flex flex-col items-center gap-1 py-3">
      <span
        className={`${info} ${props.parentLabel ? "text-sky-600 dark:text-sky-400" : "text-slate-300 dark:text-slate-600"}`}
      >
        {props.parentLabel ?? "—"}
      </span>
      <Tooltip label="Select parent" side="top">
        <button
          type="button"
          className={arrowBtn}
          disabled={!props.parentLabel}
          onClick={props.onParent}
        >
          <RiArrowUpDoubleLine size={16} />
        </button>
      </Tooltip>

      <div className="flex items-center gap-1.5">
        <Tooltip label="Previous sibling" side="top">
          <button
            type="button"
            className={arrowBtn}
            disabled={!props.prevLabel}
            onClick={props.onPrev}
          >
            <RiArrowLeftDoubleLine size={16} />
          </button>
        </Tooltip>
        <Tooltip label="Scroll into view" side="top">
          <button
            type="button"
            onClick={props.onCenter}
            className="min-w-0 max-w-[10rem] truncate rounded-md bg-slate-900 px-2.5 py-1 font-medium font-mono text-[11px] text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {props.currentLabel}
          </button>
        </Tooltip>
        <Tooltip label="Next sibling" side="top">
          <button
            type="button"
            className={arrowBtn}
            disabled={!props.nextLabel}
            onClick={props.onNext}
          >
            <RiArrowRightDoubleLine size={16} />
          </button>
        </Tooltip>
      </div>

      <Tooltip label="Select first child" side="bottom">
        <button
          type="button"
          className={arrowBtn}
          disabled={!props.childLabel}
          onClick={props.onChild}
        >
          <RiArrowDownDoubleLine size={16} />
        </button>
      </Tooltip>
      <span
        className={`${info} ${props.childLabel ? "text-slate-400" : "text-slate-300 dark:text-slate-600"}`}
      >
        {props.childLabel ?? "—"}
      </span>
    </div>
  )
}
