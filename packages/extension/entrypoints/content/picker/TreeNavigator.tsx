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
  "max-w-[8rem] truncate rounded px-2 py-0.5 font-mono text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"

/**
 * Visual DOM-tree navigator: walk to parent (▲), first child (▼), or previous /
 * next sibling (« »). Clicking re-targets the selection. See DESIGN.md §5.1d.
 */
export function TreeNavigator(props: TreeNavigatorProps) {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <button type="button" className={node} disabled={!props.parentLabel} onClick={props.onParent}>
        {props.parentLabel ?? "—"}
      </button>
      <span className="text-slate-300">▲</span>
      <div className="flex items-center gap-1">
        <button type="button" className={node} disabled={!props.prevLabel} onClick={props.onPrev}>
          «
        </button>
        <span className="max-w-[9rem] truncate rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-white">
          {props.currentLabel}
        </span>
        <button type="button" className={node} disabled={!props.nextLabel} onClick={props.onNext}>
          »
        </button>
      </div>
      <span className="text-slate-300">▼</span>
      <button type="button" className={node} disabled={!props.childLabel} onClick={props.onChild}>
        {props.childLabel ?? "—"}
      </button>
    </div>
  )
}
