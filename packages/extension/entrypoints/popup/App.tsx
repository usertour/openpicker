import { RiCrosshair2Line, RiSettings3Line } from "@remixicon/react"

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
    <div className="w-72 p-4 font-sans text-slate-800">
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 text-white">
          <RiCrosshair2Line size={16} />
        </span>
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">openpicker</div>
          <div className="text-[11px] text-slate-400">Pick an element, get its selector</div>
        </div>
      </div>

      <button
        type="button"
        onClick={pickHere}
        className="mt-4 flex w-full items-center gap-2.5 rounded-lg bg-slate-900 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-slate-700"
      >
        <RiCrosshair2Line size={16} className="shrink-0" />
        Pick an element on this page
      </button>

      <button
        type="button"
        onClick={openOptions}
        className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 text-sm transition-colors hover:bg-slate-50"
      >
        <RiSettings3Line size={16} className="shrink-0" />
        Manage authorized sites
      </button>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>v{version}</span>
        <a
          href="https://github.com/usertour/openpicker"
          target="_blank"
          rel="noreferrer"
          className="hover:text-slate-600 hover:underline"
        >
          Docs
        </a>
      </div>
    </div>
  )
}
