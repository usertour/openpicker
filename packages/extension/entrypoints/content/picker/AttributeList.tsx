import { useMemo, useState } from "react"
import type { AttrEntry } from "./dom"

interface AttributeListProps {
  attributes: AttrEntry[]
  /** Names the user checked as extra match criteria. */
  checked: Set<string>
  onToggle: (name: string) => void
}

const TRUNCATE = 120

function AttributeCard({
  entry,
  isChecked,
  onToggle,
}: {
  entry: AttrEntry
  isChecked: boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const long = entry.value.length > TRUNCATE
  const shown = expanded || !long ? entry.value : `${entry.value.slice(0, TRUNCATE)}…`
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-slate-700">{entry.name}</span>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onToggle}
          title="Use as an extra match criterion"
        />
      </div>
      <div className="mt-1 break-all font-mono text-[11px] text-slate-500">
        {shown || <span className="italic text-slate-300">empty</span>}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-medium text-blue-600 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}

/** Searchable list of element attributes, each checkable as a match criterion. */
export function AttributeList({ attributes, checked, onToggle }: AttributeListProps) {
  const [filter, setFilter] = useState("")
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return attributes
    return attributes.filter((a) => a.name.toLowerCase().includes(q))
  }, [attributes, filter])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <input
        type="text"
        value={filter}
        placeholder="🔍 filter attributes…"
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {visible.map((entry) => (
          <AttributeCard
            key={entry.name}
            entry={entry}
            isChecked={checked.has(entry.name)}
            onToggle={() => onToggle(entry.name)}
          />
        ))}
      </div>
    </div>
  )
}
