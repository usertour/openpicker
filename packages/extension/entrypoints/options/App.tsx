import { useCallback, useEffect, useState } from "react"

/**
 * Options / config page (opened from the toolbar icon's context menu, or
 * chrome://extensions). Reviews and revokes the per-origin consent decisions the
 * just-in-time prompt produced. See PROTOCOL.md §7.
 */

const CONSENT_PREFIX = "consent:"

interface Decision {
  origin: string
  status: "granted" | "denied"
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

export function App() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setDecisions(await loadDecisions())
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const remove = useCallback(
    async (origin: string) => {
      await browser.storage.local.remove(`${CONSENT_PREFIX}${origin}`)
      await refresh()
    },
    [refresh],
  )

  const granted = decisions.filter((d) => d.status === "granted")
  const denied = decisions.filter((d) => d.status === "denied")

  return (
    <main className="mx-auto max-w-2xl p-6 font-sans text-slate-800">
      <h1 className="text-xl font-semibold">openpicker</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage which sites are allowed to use the element picker.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <Section
            title="Allowed sites"
            empty="No sites allowed yet."
            decisions={granted}
            actionLabel="Revoke"
            onAction={remove}
          />
          <Section
            title="Blocked sites"
            empty="No sites blocked."
            decisions={denied}
            actionLabel="Reset"
            onAction={remove}
          />
        </>
      )}
    </main>
  )
}

function Section({
  title,
  empty,
  decisions,
  actionLabel,
  onAction,
}: {
  title: string
  empty: string
  decisions: Decision[]
  actionLabel: string
  onAction: (origin: string) => void
}) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      {decisions.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {decisions.map((d) => (
            <li key={d.origin} className="flex items-center justify-between px-3 py-2">
              <span className="font-mono text-sm">{d.origin}</span>
              <button
                type="button"
                onClick={() => onAction(d.origin)}
                className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                {actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
