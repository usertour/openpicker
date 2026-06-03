import { RiCheckLine, RiCrosshair2Line } from "@remixicon/react"
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
    note: "Any site can use the picker. Nothing is captured without you picking and confirming.",
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

  // In blocklist mode only the blocked (denied) entries matter; allowed ones are moot.
  const visibleDecisions =
    mode === "blocklist" ? decisions.filter((d) => d.status === "denied") : decisions

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="border-slate-200 border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-6 py-3.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 text-white">
            <RiCrosshair2Line size={16} />
          </span>
          <span className="font-semibold tracking-tight">openpicker</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {/* Authorization mode */}
        <section>
          <h2 className="font-semibold text-base">Authorization</h2>
          <p className="mt-0.5 text-slate-500 text-sm">
            Choose which sites may use the element picker.
          </p>

          <div className="mt-4 space-y-2">
            {MODES.map((m) => {
              const selected = mode === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                    selected
                      ? "border-slate-900 bg-white shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full border transition ${
                      selected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {selected && <RiCheckLine size={11} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-sm">{m.label}</span>
                    <span className="mt-0.5 block text-slate-500 text-xs leading-relaxed">
                      {m.note}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Per-origin management — only meaningful when a mode actually uses the list. */}
        {mode === "allow-all" ? null : (
          <section className="mt-8">
            <h2 className="font-semibold text-base">
              {mode === "blocklist" ? "Blocked sites" : "Site permissions"}
            </h2>
            <p className="mt-0.5 text-slate-500 text-sm">
              {mode === "blocklist"
                ? "Sites listed here can never use the picker."
                : "Allow or block specific sites ahead of time."}
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* Add row */}
              <div className="border-slate-100 border-b p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="op-origin"
                    type="text"
                    value={newOrigin}
                    placeholder="https://example.com"
                    onChange={(e) => setNewOrigin(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && add(mode === "blocklist" ? "denied" : "granted")
                    }
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                  {mode === "ask" && (
                    <button
                      type="button"
                      onClick={() => add("granted")}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-sm text-white transition-colors hover:bg-slate-700"
                    >
                      Allow
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => add("denied")}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 text-sm transition-colors hover:bg-slate-50"
                  >
                    Block
                  </button>
                </div>
                {error && <p className="mt-2 text-rose-600 text-xs">{error}</p>}
              </div>

              {/* List */}
              {loading ? (
                <p className="px-4 py-8 text-center text-slate-400 text-sm">Loading…</p>
              ) : visibleDecisions.length === 0 ? (
                <p className="px-4 py-8 text-center text-slate-400 text-sm">
                  {mode === "blocklist" ? "No sites blocked yet." : "No sites configured yet."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {visibleDecisions.map((d) => {
                    const granted = d.status === "granted"
                    return (
                      <li
                        key={d.origin}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
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
                              className="rounded-md px-2 py-1 font-medium text-slate-600 text-xs transition-colors hover:bg-slate-100"
                            >
                              {granted ? "Block" : "Allow"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => reset(d.origin)}
                            title="Remove this decision"
                            className="rounded-md px-2 py-1 font-medium text-slate-500 text-xs transition-colors hover:bg-slate-100"
                          >
                            {mode === "blocklist" ? "Unblock" : "Reset"}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
