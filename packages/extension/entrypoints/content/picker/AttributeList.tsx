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
    <div className="rounded-lg border border-slate-200 p-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50/60">
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative">
        <RiSearchLine
          size={14}
          className="-translate-y-1/2 absolute top-1/2 left-2.5 text-slate-400"
        />
        <input
          type="text"
          value={filter}
          placeholder="Filter attributes…"
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-2.5 pl-8 text-xs outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      </div>
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
