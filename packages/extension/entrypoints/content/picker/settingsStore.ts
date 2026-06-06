import { coerceSelectorSettings, type SelectorSettings } from "./selectorSettings"

/**
 * Persist selector settings. A site's conventions differ (one uses `data-testid`,
 * another stable ids/classes), so "how to build selectors" is remembered **per
 * origin**; a **global default** applies where a site has no override. Both live in
 * chrome.storage.local and are read on every pick. Stored values are coerced/
 * migrated on load (legacy shape → current). See DESIGN.md §5.1f / §6.
 */

const PREFIX = "op:selectorSettings:"
const originKey = (origin: string) => `${PREFIX}${origin}`
// "global" is not a valid origin, so this never collides with a per-site key.
const GLOBAL_KEY = `${PREFIX}global`

export async function loadSelectorSettings(origin: string): Promise<SelectorSettings | null> {
  try {
    const k = originKey(origin)
    return coerceSelectorSettings((await browser.storage.local.get(k))[k])
  } catch {
    return null
  }
}

export function saveSelectorSettings(origin: string, settings: SelectorSettings): void {
  try {
    void browser.storage.local.set({ [originKey(origin)]: settings })
  } catch {
    // storage unavailable; settings just won't persist this session
  }
}

export async function loadGlobalSelectorSettings(): Promise<SelectorSettings | null> {
  try {
    return coerceSelectorSettings((await browser.storage.local.get(GLOBAL_KEY))[GLOBAL_KEY])
  } catch {
    return null
  }
}

export function saveGlobalSelectorSettings(settings: SelectorSettings): void {
  try {
    void browser.storage.local.set({ [GLOBAL_KEY]: settings })
  } catch {
    // storage unavailable
  }
}

/** All per-origin overrides (excludes the global default), for the options page. */
export async function listSelectorOriginSettings(): Promise<Record<string, SelectorSettings>> {
  try {
    const all = await browser.storage.local.get(null)
    const out: Record<string, SelectorSettings> = {}
    for (const [k, v] of Object.entries(all)) {
      if (!k.startsWith(PREFIX) || k === GLOBAL_KEY) continue
      const settings = coerceSelectorSettings(v)
      if (settings) out[k.slice(PREFIX.length)] = settings
    }
    return out
  } catch {
    return {}
  }
}

/** Remove a per-origin override (the site falls back to the global default). */
export function removeSelectorSettings(origin: string): void {
  try {
    void browser.storage.local.remove(originKey(origin))
  } catch {
    // storage unavailable
  }
}
