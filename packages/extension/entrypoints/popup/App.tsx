import { RiCrosshair2Line, RiSettings3Line } from "@remixicon/react"
import { i18n } from "#i18n"
import { BrandLockup } from "@/components/Brand"
import { ThemeToggle } from "@/components/ThemeToggle"

/**
 * Toolbar popup — the picker's home. Start a pick on the current page, or open the
 * options page (authorized sites & settings). Kept intentionally small: openpicker
 * is a focused tool, not a dashboard.
 */

async function pickHere(): Promise<void> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (tab?.id !== undefined) {
      await browser.tabs.sendMessage(tab.id, { kind: "startPick" })
    }
  } catch {
    // No content script here (e.g. chrome:// or the web store) — nothing to start.
  }
  window.close()
}

function openOptions(): void {
  void browser.runtime.openOptionsPage()
  window.close()
}

export function App() {
  const version = browser.runtime.getManifest().version
  return (
    <div
      style={{ background: "var(--op-panel)" }}
      className="w-72 p-4 font-sans text-slate-800 dark:text-slate-200"
    >
      <BrandLockup tagline />

      <button
        type="button"
        onClick={pickHere}
        style={{ background: "var(--op-accent-grad)" }}
        className="mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 font-medium text-[13px] text-white shadow-md shadow-accent-600/30 outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-accent-400"
      >
        <RiCrosshair2Line size={15} className="shrink-0" />
        {i18n.t("popup.pickThisPage")}
      </button>

      <button
        type="button"
        onClick={openOptions}
        className="mt-2 flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-[13px] text-slate-700 outline-none transition hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:border-accent-700 dark:hover:bg-accent-950/40 dark:hover:text-accent-200"
      >
        <RiSettings3Line size={15} className="shrink-0" />
        {i18n.t("popup.manageSites")}
      </button>

      <div className="mt-3 flex items-center justify-between">
        <ThemeToggle />
        <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
          <span>v{version}</span>
          <a
            href="https://docs.openpicker.dev"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-accent-600 hover:underline dark:hover:text-accent-300"
          >
            {i18n.t("popup.docs")}
          </a>
        </div>
      </div>
    </div>
  )
}
