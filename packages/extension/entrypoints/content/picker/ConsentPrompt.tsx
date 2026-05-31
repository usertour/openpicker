interface ConsentPromptProps {
  origin: string
  appName?: string
  onAllow: () => void
  onDeny: () => void
}

/**
 * Just-in-time per-origin consent prompt shown the first time an origin uses the
 * picker. The origin is authoritative; appName is display-only. See PROTOCOL.md §7.
 */
export function ConsentPrompt({ origin, appName, onAllow, onDeny }: ConsentPromptProps) {
  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-900/40">
      <div className="w-[min(420px,92vw)] rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-base font-semibold text-slate-800">Allow element picking?</h2>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-mono font-medium text-slate-800">{origin}</span>
          {appName ? (
            <>
              {" "}
              (<span className="italic">{appName}</span>)
            </>
          ) : null}{" "}
          wants to use openpicker to select an element on this page.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDeny}
            className="rounded-lg px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={onAllow}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
