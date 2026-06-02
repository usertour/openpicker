import { RiSearchLine } from "@remixicon/react"
import { useMemo, useState } from "react"
import type { AttrEntry } from "./dom"

interface AttributeListProps {
  attributes: AttrEntry[]
}

const TRUNCATE = 120

function AttributeCard({ entry }: { entry: AttrEntry }) {
  const [expanded, setExpanded] = useState(false)
  const long = entry.value.length > TRUNCATE
  const shown = expanded || !long ? entry.value : `${entry.value.slice(0, TRUNCATE)}…`
  return (
    <div className="px-0.5 py-1">
      <span className="block truncate font-mono font-semibold text-slate-700 text-xs">
        {entry.name}
      </span>
      <div className="mt-1 break-all font-mono text-[11px] text-slate-500 leading-relaxed">
        {shown || <span className="text-slate-300 italic">empty</span>}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 font-medium text-[11px] text-slate-500 hover:text-slate-700 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}

/** Read-only, searchable list of the selected element's attributes and content. */
export function AttributeList({ attributes }: AttributeListProps) {
  const [filter, setFilter] = useState("")
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return attributes
    return attributes.filter((a) => a.name.toLowerCase().includes(q))
  }, [attributes, filter])

  // The filter only earns its row when there are enough attributes to scan.
  const showFilter = attributes.length > 8

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {showFilter && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 transition focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200">
          <RiSearchLine size={14} className="shrink-0 text-slate-400" />
          <input
            type="text"
            value={filter}
            placeholder="Filter attributes…"
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-transparent py-2 text-xs outline-none"
          />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {visible.length === 0 ? (
          <p className="px-1 py-3 text-center text-[11px] text-slate-400">No matching attributes.</p>
        ) : (
          visible.map((entry) => <AttributeCard key={entry.name} entry={entry} />)
        )}
      </div>
    </div>
  )
}
