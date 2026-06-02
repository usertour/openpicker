import { useCallback, useEffect, useState } from "react"

/**
 * Options page (opened from the toolbar icon's context menu, or chrome://extensions).
 * Manage the per-origin authorization the just-in-time prompt produces: review,
 * toggle allow/block, reset (re-prompt next time), or add an origin by hand.
 * See PROTOCOL.md §7. The `consent:<origin>` keys match background.ts.
 */

const CONSENT_PREFIX = "consent:"

type Status = "granted" | "denied"
interface Decision {
  origin: string
  status: Status
}

async function loadDecisions(): Promise<Decision[]> {
  const all = await browser.storage.local.get(null)
  const out: Decision[] = []
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(CONSENT_PREFIX)) continue
    if (value !== "granted" && value !== "denied") continue
    out.push({ origin: key.slice(CONSENT_PREFIX.length), status: value })
  }
  return out.sort((a, b) => a.origin.localeCompare(b.origin))
}

/** Normalize free text to an origin, e.g. "example.com" → "https://example.com". */
function normalizeOrigin(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).origin
  } catch {
    return null
  }
}

export function App() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [newOrigin, setNewOrigin] = useState("")
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setDecisions(await loadDecisions())
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const onChange = (_changes: unknown, area: string) => {
      if (area === "local") void refresh()
    }
    browser.storage.onChanged.addListener(onChange)
    return () => browser.storage.onChanged.removeListener(onChange)
  }, [refresh])

  const setStatus = useCallback(async (origin: string, status: Status) => {
    await browser.storage.local.set({ [`${CONSENT_PREFIX}${origin}`]: status })
  }, [])

  const reset = useCallback(async (origin: string) => {
    await browser.storage.local.remove(`${CONSENT_PREFIX}${origin}`)
  }, [])

  const add = useCallback(
    async (status: Status) => {
      const origin = normalizeOrigin(newOrigin)
      if (!origin) {
        setError("Enter a valid origin, e.g. https://example.com")
        return
      }
      setError("")
      setNewOrigin("")
      await setStatus(origin, status)
    },
    [newOrigin, setStatus],
  )

  return (
    <main className="mx-auto max-w-2xl p-6 font-sans text-slate-800">
      <h1 className="font-semibold text-xl">openpicker</h1>
      <p className="mt-1 text-slate-500 text-sm">
        Manage which sites may use the element picker. Sites are asked the first time;
        your choice is remembered here and can be changed anytime.
      </p>

      {/* Add by hand */}
      <div className="mt-5 rounded-xl border border-slate-200 p-3">
        <label htmlFor="op-origin" className="font-medium text-slate-700 text-sm">
          Add a site
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            id="op-origin"
            type="text"
            value={newOrigin}
            placeholder="https://example.com"
            onChange={(e) => setNewOrigin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add("granted")}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
          <button
            type="button"
            onClick={() => add("granted")}
            className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-sm text-white hover:bg-blue-500"
          >
            Allow
          </button>
          <button
            type="button"
            onClick={() => add("denied")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 text-sm hover:bg-slate-50"
          >
            Block
          </button>
        </div>
        {error && <p className="mt-2 text-rose-600 text-xs">{error}</p>}
      </div>

      {/* List */}
      {loading ? (
        <p className="mt-6 text-slate-400 text-sm">Loading…</p>
      ) : decisions.length === 0 ? (
        <p className="mt-6 text-slate-400 text-sm">No sites configured yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {decisions.map((d) => {
            const granted = d.status === "granted"
            return (
              <li key={d.origin} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-[11px] ${
                      granted ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {granted ? "Allowed" : "Blocked"}
                  </span>
                  <span className="truncate font-mono text-sm">{d.origin}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStatus(d.origin, granted ? "denied" : "granted")}
                    className="rounded-md px-2 py-1 font-medium text-slate-600 text-xs hover:bg-slate-100"
                  >
                    {granted ? "Block" : "Allow"}
                  </button>
                  <button
                    type="button"
                    onClick={() => reset(d.origin)}
                    title="Forget — the site will be asked again next time"
                    className="rounded-md px-2 py-1 font-medium text-slate-500 text-xs hover:bg-slate-100"
                  >
                    Reset
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
