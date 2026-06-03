import { RiComputerLine, RiMoonLine, RiSunLine } from "@remixicon/react"
import { useCallback, useEffect, useState } from "react"
import { getTheme, setTheme, THEME_KEY, type Theme } from "@/lib/theme"

const OPTIONS: { value: Theme; label: string; Icon: typeof RiSunLine }[] = [
  { value: "light", label: "Light", Icon: RiSunLine },
  { value: "dark", label: "Dark", Icon: RiMoonLine },
  { value: "system", label: "System", Icon: RiComputerLine },
]

/**
 * Light / Dark / System segmented control. `labels` shows text beside each icon
 * (options page); without it the control is icon-only (popup). Reads/writes the
 * shared `theme` in storage.local and stays in sync across surfaces.
 */
export function ThemeToggle({ labels = false }: { labels?: boolean }) {
  const [theme, setThemeState] = useState<Theme>("system")

  useEffect(() => {
    void getTheme().then(setThemeState)
    const onChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== "local" || !(THEME_KEY in changes)) return
      const v = changes[THEME_KEY]?.newValue
      setThemeState(v === "light" || v === "dark" ? v : "system")
    }
    browser.storage.onChanged.addListener(onChange)
    return () => browser.storage.onChanged.removeListener(onChange)
  }, [])

  const choose = useCallback((next: Theme) => {
    setThemeState(next)
    void setTheme(next)
  }, [])

  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-xs transition-colors ${
              active
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Icon size={14} />
            {labels && <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
