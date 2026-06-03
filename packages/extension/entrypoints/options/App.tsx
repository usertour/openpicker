import { useCallback, useEffect, useState } from "react"

/**
 * Options page (opened from the popup or chrome://extensions). Sets the
 * authorization mode and manages the per-origin allow/block decisions it uses.
 * See DESIGN.md §6. Keys (`authMode`, `consent:<origin>`) match the content script.
 */

const CONSENT_PREFIX = "consent:"
const MODE_KEY = "authMode"

type AuthMode = "allow-all" | "ask" | "blocklist"
type Status = "granted" | "denied"
interface Decision {
  origin: string
  status: Status
}

const MODES: { value: AuthMode; label: string; note: string }[] = [
  {
    value: "allow-all",
    label: "Allow all",
    note: "Any site can use the picker. Nothing is captured without you picking and confirming. Switch to Ask or Blocklist to manage specific sites.",
  },
  {
    value: "ask",
    label: "Ask each site",
    note: "Each site is asked the first time; your choice is remembered in the list below.",
  },
  {
    value: "blocklist",
    label: "Blocklist",
    note: "Every site is allowed except the ones you block below.",
  },
]

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

async function loadMode(): Promise<AuthMode> {
  const v = (await browser.storage.local.get(MODE_KEY))[MODE_KEY]
  return v === "ask" || v === "blocklist" ? v : "allow-all"
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
  const [mode, setModeState] = useState<AuthMode>("allow-all")
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [newOrigin, setNewOrigin] = useState("")
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    const [d, m] = await Promise.all([loadDecisions(), loadMode()])
    setDecisions(d)
    setModeState(m)
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

  const setMode = useCallback(async (m: AuthMode) => {
    await browser.storage.local.set({ [MODE_KEY]: m })
  }, [])

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

  const activeNote = MODES.find((m) => m.value === mode)?.note ?? ""
  // In blocklist mode only the blocked (denied) entries matter; allowed ones are moot.
  const visibleDecisions = mode === "blocklist" ? decisions.filter((d) => d.status === "denied") : decisions

  return (
    <main className="mx-auto max-w-2xl p-6 font-sans text-slate-800">
      <h1 className="font-semibold text-xl">openpicker</h1>
      <p className="mt-1 text-slate-500 text-sm">Control which sites may use the element picker.</p>

      {/* Authorization mode */}
      <div className="mt-5">
        <span className="font-semibold text-[11px] text-slate-500 uppercase tracking-wider">
          Authorization
        </span>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`rounded-md py-1.5 font-medium transition-colors ${
                mode === m.value
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-slate-500 text-xs">{activeNote}</p>
      </div>

      {/* Per-origin management — only meaningful when a mode actually uses the list. */}
      {mode === "allow-all" ? null : (
        <>
          <div className="mt-5 rounded-xl border border-slate-200 p-3">
            <label htmlFor="op-origin" className="font-medium text-slate-700 text-sm">
              {mode === "blocklist" ? "Block a site" : "Add a site"}
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                id="op-origin"
                type="text"
                value={newOrigin}
                placeholder="https://example.com"
                onChange={(e) => setNewOrigin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add(mode === "blocklist" ? "denied" : "granted")}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              {mode === "ask" && (
                <button
                  type="button"
                  onClick={() => add("granted")}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-sm text-white hover:bg-blue-500"
                >
                  Allow
                </button>
              )}
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

          {loading ? (
            <p className="mt-6 text-slate-400 text-sm">Loading…</p>
          ) : visibleDecisions.length === 0 ? (
            <p className="mt-6 text-slate-400 text-sm">
              {mode === "blocklist" ? "No sites blocked." : "No sites configured yet."}
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {visibleDecisions.map((d) => {
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
                      {mode === "ask" && (
                        <button
                          type="button"
                          onClick={() => setStatus(d.origin, granted ? "denied" : "granted")}
                          className="rounded-md px-2 py-1 font-medium text-slate-600 text-xs hover:bg-slate-100"
                        >
                          {granted ? "Block" : "Allow"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => reset(d.origin)}
                        title="Remove this decision"
                        className="rounded-md px-2 py-1 font-medium text-slate-500 text-xs hover:bg-slate-100"
                      >
                        {mode === "blocklist" ? "Unblock" : "Reset"}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
