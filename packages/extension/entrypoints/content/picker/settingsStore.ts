import type { SelectorSettings } from "./SettingsPopover"

/**
 * Persist the selector settings per target origin: a site's conventions differ
 * (one uses `data-testid`, another stable ids/classes), so "how to build selectors
 * here" is remembered per origin, not globally. Stored in chrome.storage.local.
 */

const key = (origin: string) => `op:selectorSettings:${origin}`

export async function loadSelectorSettings(origin: string): Promise<SelectorSettings | null> {
  try {
    const k = key(origin)
    const value = (await browser.storage.local.get(k))[k]
    return value ? (value as SelectorSettings) : null
  } catch {
    return null
  }
}

export function saveSelectorSettings(origin: string, settings: SelectorSettings): void {
  try {
    void browser.storage.local.set({ [key(origin)]: settings })
  } catch {
    // storage unavailable; settings just won't persist this session
  }
}
