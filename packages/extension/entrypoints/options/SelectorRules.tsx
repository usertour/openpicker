import { useCallback, useEffect, useState } from "react"
import { i18n } from "#i18n"
import { SelectorRulesFields } from "@/entrypoints/content/picker/SelectorRulesFields"
import {
  defaultSelectorSettings,
  type SelectorSettings,
} from "@/entrypoints/content/picker/selectorSettings"
import {
  listSelectorOriginSettings,
  loadGlobalSelectorSettings,
  removeSelectorSettings,
  saveGlobalSelectorSettings,
  saveSelectorSettings,
} from "@/entrypoints/content/picker/settingsStore"

/**
 * Options-page section: pre-configure how selectors are built — a **global default**
 * plus **per-site overrides** — without starting a pick. Writes the same per-origin /
 * global stores the picker's gear reads. See DESIGN.md §5.1f.
 */

interface OriginRule {
  origin: string
  settings: SelectorSettings
}

function normalizeOrigin(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).origin
  } catch {
    return null
  }
}

function sortByOrigin(rules: OriginRule[]): OriginRule[] {
  return [...rules].sort((a, b) => a.origin.localeCompare(b.origin))
}

export function SelectorRules() {
  const [global, setGlobal] = useState<SelectorSettings | null>(null)
  const [origins, setOrigins] = useState<OriginRule[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newOrigin, setNewOrigin] = useState("")
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    const [g, list] = await Promise.all([
      loadGlobalSelectorSettings(),
      listSelectorOriginSettings(),
    ])
    setGlobal(g ?? defaultSelectorSettings())
    setOrigins(
      sortByOrigin(Object.entries(list).map(([origin, settings]) => ({ origin, settings }))),
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updateGlobal = useCallback((patch: Partial<SelectorSettings>) => {
    setGlobal((g) => {
      const next = { ...(g ?? defaultSelectorSettings()), ...patch }
      saveGlobalSelectorSettings(next)
      return next
    })
  }, [])

  const updateOrigin = useCallback((origin: string, patch: Partial<SelectorSettings>) => {
    setOrigins((list) =>
      list.map((row) => {
        if (row.origin !== origin) return row
        const next = { ...row.settings, ...patch }
        saveSelectorSettings(origin, next)
        return { origin, settings: next }
      }),
    )
  }, [])

  const addOrigin = useCallback(() => {
    const origin = normalizeOrigin(newOrigin)
    if (!origin) {
      setError(i18n.t("options.invalidOrigin"))
      return
    }
    setError("")
    setNewOrigin("")
    setExpanded(origin)
    setOrigins((list) => {
      if (list.some((r) => r.origin === origin)) return list
      const settings = global ?? defaultSelectorSettings()
      saveSelectorSettings(origin, settings)
      return sortByOrigin([...list, { origin, settings }])
    })
  }, [newOrigin, global])

  const remove = useCallback(
    (origin: string) => {
      removeSelectorSettings(origin)
      setOrigins((list) => list.filter((r) => r.origin !== origin))
      if (expanded === origin) setExpanded(null)
    },
    [expanded],
  )

  if (!global) return null

  return (
    <section className="mt-8">
      <h2 className="font-semibold text-base">{i18n.t("options.selectorRulesTitle")}</h2>
      <p className="mt-0.5 text-slate-500 text-sm dark:text-slate-400">
        {i18n.t("options.selectorRulesDesc")}
      </p>

      {/* Global default */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <span className="font-semibold text-[10px] text-slate-500 uppercase tracking-wider dark:text-slate-400">
          {i18n.t("options.globalDefault")}
        </span>
        <div className="mt-3">
          <SelectorRulesFields settings={global} onChange={updateGlobal} />
        </div>
      </div>

      {/* Per-site overrides */}
      <div className="mt-6">
        <h3 className="font-medium text-sm">{i18n.t("options.perSiteRules")}</h3>
        <p className="mt-0.5 text-slate-500 text-sm dark:text-slate-400">
          {i18n.t("options.perSiteRulesDesc")}
        </p>

        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-slate-100 border-b p-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newOrigin}
                placeholder="https://example.com"
                onChange={(e) => setNewOrigin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addOrigin()}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-accent-500 dark:focus:ring-accent-500/30"
              />
              <button
                type="button"
                onClick={addOrigin}
                style={{ background: "var(--op-accent-grad)" }}
                className="rounded-lg px-3 py-1.5 font-medium text-sm text-white shadow-lg shadow-accent-600/30 outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-accent-400"
              >
                {i18n.t("options.add")}
              </button>
            </div>
            {error && <p className="mt-2 text-rose-600 text-xs dark:text-rose-400">{error}</p>}
          </div>

          {origins.length === 0 ? (
            <p className="px-4 py-8 text-center text-slate-400 text-sm dark:text-slate-500">
              {i18n.t("options.noSiteRules")}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {origins.map((row) => {
                const open = expanded === row.origin
                return (
                  <li key={row.origin} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-sm">{row.origin}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : row.origin)}
                          className="rounded-md px-2 py-1 font-medium text-slate-600 text-xs transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {open ? i18n.t("options.done") : i18n.t("options.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(row.origin)}
                          className="rounded-md px-2 py-1 font-medium text-slate-500 text-xs transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          {i18n.t("options.reset")}
                        </button>
                      </div>
                    </div>
                    {open && (
                      <div className="mt-3">
                        <SelectorRulesFields
                          settings={row.settings}
                          onChange={(patch) => updateOrigin(row.origin, patch)}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
