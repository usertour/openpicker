import {
  createOpenpicker,
  matchesSelectorConfig,
  OpenpickerError,
  type ScreenshotMode,
  type SelectorConfig,
} from "@openpicker/sdk"

const out = document.getElementById("out") as HTMLPreElement
const shot = document.getElementById("shot") as HTMLImageElement
const statusEl = document.getElementById("status") as HTMLSpanElement
const op = createOpenpicker({ appName: "openpicker playground" })

function show(label: string, value: unknown): void {
  out.textContent = `${label}\n${JSON.stringify(value, null, 2)}`
}

function showError(label: string, error: unknown): void {
  if (error instanceof OpenpickerError) {
    show(`${label} (error)`, { code: error.code, message: error.message })
  } else {
    show(`${label} (error)`, String(error))
  }
}

function showShot(screenshot: string | undefined): void {
  if (screenshot) {
    shot.src = screenshot
    shot.style.display = "block"
  } else {
    shot.style.display = "none"
  }
}

function screenshotMode(): ScreenshotMode {
  return (document.getElementById("shotMode") as HTMLSelectElement).value as ScreenshotMode
}

const checked = (id: string) => (document.getElementById(id) as HTMLInputElement).checked

function buildSelectorConfig(): SelectorConfig | undefined {
  const config: SelectorConfig = {}
  const allow = (document.getElementById("attrAllow") as HTMLInputElement).value.trim()
  if (allow) config.attr = { allow }
  if (!checked("useId")) config.id = { enabled: false }
  if (!checked("useClass")) config.class = { enabled: false }
  if (!checked("useTag")) config.tag = { enabled: false }
  return Object.keys(config).length > 0 ? config : undefined
}

document.getElementById("ping")?.addEventListener("click", async () => {
  statusEl.textContent = "extension status: pinging…"
  try {
    const r = await op.ping()
    statusEl.textContent = `extension status: installed (v${r.extensionVersion}, caps: ${r.capabilities.join(", ")})`
    show("ping ok", r)
  } catch (error) {
    statusEl.textContent = "extension status: NOT installed / no response"
    showError("ping", error)
  }
})

document.getElementById("pickUrl")?.addEventListener("click", async () => {
  const url = (document.getElementById("url") as HTMLInputElement).value.trim()
  if (!url) return show("pick", { error: "enter a URL first" })
  out.textContent = `opening ${url} and picking there…`
  showShot(undefined)
  try {
    const config = buildSelectorConfig()
    const r = await op.pick({
      url,
      screenshot: screenshotMode(),
      selector: config,
      lockSelectorSettings: checked("lockSettings"),
      lockSelectorEdit: checked("lockEdit"),
      requireUniqueMatch: checked("reqUnique"),
    })
    show("pick ok", {
      ...r,
      matchesSelectorConfig: config ? matchesSelectorConfig(r.selector, config) : "(no rules set)",
    })
    showShot(r.screenshot)
  } catch (error) {
    showError("pick", error)
  }
})
