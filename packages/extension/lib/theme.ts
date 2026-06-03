/**
 * Light / Dark / System theme for openpicker's own UI (popup, options, picker).
 *
 * The choice is stored in storage.local under `theme` (default "system") and shared
 * by all three surfaces. "system" follows the OS via prefers-color-scheme; "light"
 * and "dark" are explicit overrides. Dark mode is class-based: a `.dark` class on the
 * surface root, matched by the `@custom-variant dark` declared in each CSS entry.
 */

export type Theme = "light" | "dark" | "system"

export const THEME_KEY = "theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"

function normalize(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : "system"
}

/** The stored theme, or "system" if unset/invalid. */
export async function getTheme(): Promise<Theme> {
  return normalize((await browser.storage.local.get(THEME_KEY))[THEME_KEY])
}

/** Persist the chosen theme (broadcasts to other surfaces via storage.onChanged). */
export async function setTheme(theme: Theme): Promise<void> {
  await browser.storage.local.set({ [THEME_KEY]: theme })
}

/** Whether the given theme resolves to dark right now (system → OS preference). */
export function isDark(theme: Theme): boolean {
  if (theme === "system") return window.matchMedia(DARK_QUERY).matches
  return theme === "dark"
}

/** Toggle the `.dark` class on a surface root to match the resolved theme. */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  root.classList.toggle("dark", isDark(theme))
}

/**
 * Apply the stored theme to `root` now, then keep it in sync: re-apply when the
 * stored theme changes (any surface) and when the OS preference changes while on
 * "system". Returns a cleanup function.
 */
export function watchTheme(root: HTMLElement): () => void {
  let current: Theme = "system"

  void getTheme().then((theme) => {
    current = theme
    applyTheme(root, theme)
  })

  const onStorage = (changes: Record<string, { newValue?: unknown }>, area: string): void => {
    if (area !== "local" || !(THEME_KEY in changes)) return
    current = normalize(changes[THEME_KEY]?.newValue)
    applyTheme(root, current)
  }
  browser.storage.onChanged.addListener(onStorage)

  const media = window.matchMedia(DARK_QUERY)
  const onMedia = (): void => {
    if (current === "system") applyTheme(root, current)
  }
  media.addEventListener("change", onMedia)

  return () => {
    browser.storage.onChanged.removeListener(onStorage)
    media.removeEventListener("change", onMedia)
  }
}
