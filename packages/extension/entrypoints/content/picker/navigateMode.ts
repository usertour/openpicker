/**
 * Whether the cross-tab pick is currently in "navigate to another page" mode,
 * persisted in the target tab's sessionStorage so it survives a navigation.
 *
 * This keeps the pick in navigate mode across page loads — the user may need to hop
 * through several pages to reach their element — instead of snapping back to select
 * mode (which locks the page) on every load. The user returns to select mode
 * explicitly via "Resume picking". Cleared when the pick ends. See DESIGN.md §5d.
 */

const KEY = "openpicker:navigateMode"

export function setNavigateMode(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(KEY, "1")
    else window.sessionStorage.removeItem(KEY)
  } catch {
    // sessionStorage unavailable (rare); navigate mode just won't persist across nav.
  }
}

export function isNavigateMode(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}
