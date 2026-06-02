import {
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowUpSLine,
} from "@remixicon/react"

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
}

const node =
  "max-w-[9rem] truncate rounded-md px-2 py-1 font-mono text-[11px] text-slate-500 transition-colors hover:bg-white hover:text-slate-700 hover:shadow-sm disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:hover:shadow-none"
const arrow = "text-slate-300"
const sibBtn =
  "grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-slate-700 hover:shadow-sm disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:hover:shadow-none"

/**
 * Visual DOM-tree navigator: walk to parent (up), first child (down), or previous
 * / next sibling (left / right). Clicking re-targets the selection. See DESIGN.md §5.1d.
 */
export function TreeNavigator(props: TreeNavigatorProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-3">
      <button type="button" className={node} disabled={!props.parentLabel} onClick={props.onParent}>
        {props.parentLabel ?? "—"}
      </button>
      <RiArrowUpSLine size={14} className={arrow} />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={sibBtn}
          title="Previous sibling"
          disabled={!props.prevLabel}
          onClick={props.onPrev}
        >
          <RiArrowLeftSLine size={16} />
        </button>
        <span className="max-w-[10rem] truncate rounded-md bg-slate-900 px-2.5 py-1 font-medium font-mono text-[11px] text-white shadow-sm">
          {props.currentLabel}
        </span>
        <button
          type="button"
          className={sibBtn}
          title="Next sibling"
          disabled={!props.nextLabel}
          onClick={props.onNext}
        >
          <RiArrowRightSLine size={16} />
        </button>
      </div>
      <RiArrowDownSLine size={14} className={arrow} />
      <button type="button" className={node} disabled={!props.childLabel} onClick={props.onChild}>
        {props.childLabel ?? "—"}
      </button>
    </div>
  )
}
