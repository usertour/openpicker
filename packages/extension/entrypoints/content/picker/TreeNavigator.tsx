import {
  RiArrowDownDoubleLine,
  RiArrowLeftDoubleLine,
  RiArrowRightDoubleLine,
  RiArrowUpDoubleLine,
} from "@remixicon/react"
import { i18n } from "#i18n"
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
  "grid h-7 w-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-accent-600 hover:shadow-sm disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:hover:shadow-none dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-accent-200 dark:disabled:hover:text-slate-500"
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
        className={`${info} ${props.parentLabel ? "text-accent-600 dark:text-accent-400" : "text-slate-300 dark:text-slate-600"}`}
      >
        {props.parentLabel ?? "—"}
      </span>
      <Tooltip label={i18n.t("picker.selectParent")} side="top">
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
        <Tooltip label={i18n.t("picker.prevSibling")} side="top">
          <button
            type="button"
            className={arrowBtn}
            disabled={!props.prevLabel}
            onClick={props.onPrev}
          >
            <RiArrowLeftDoubleLine size={16} />
          </button>
        </Tooltip>
        <Tooltip label={i18n.t("picker.scrollIntoView")} side="top">
          <button
            type="button"
            onClick={props.onCenter}
            style={{ background: "var(--op-accent-grad)" }}
            className="min-w-0 max-w-[10rem] truncate rounded-md px-2.5 py-1 font-medium font-mono text-[11px] text-white shadow-md shadow-accent-600/30 transition hover:brightness-105"
          >
            {props.currentLabel}
          </button>
        </Tooltip>
        <Tooltip label={i18n.t("picker.nextSibling")} side="top">
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

      <Tooltip label={i18n.t("picker.selectFirstChild")} side="bottom">
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
