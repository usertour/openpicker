import { createOpenpicker, OpenpickerError, type ScreenshotMode } from "@openpicker/sdk"
import "./style.css"

const op = createOpenpicker({ appName: "openpicker demo", pingTimeout: 700 })

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const statusEl = byId("status")
const installEl = byId("install")
const demoEl = byId("demo")
const recheckBtn = byId<HTMLButtonElement>("recheck")
const urlInput = byId<HTMLInputElement>("url")
const shotSel = byId<HTMLSelectElement>("shot")
const pickBtn = byId<HTMLButtonElement>("pick")
const errorEl = byId("error")
const resultEl = byId("result")
const selectorEl = byId("selector")
const copyBtn = byId<HTMLButtonElement>("copy")
const metaEl = byId("meta")
const shotImg = byId<HTMLImageElement>("shotImg")

const STATUS_COLORS = {
  checking: ["bg-slate-100", "text-slate-500"],
  ok: ["bg-emerald-50", "text-emerald-700"],
  warn: ["bg-amber-50", "text-amber-700"],
} as const

function setStatus(text: string, kind: keyof typeof STATUS_COLORS): void {
  statusEl.textContent = text
  statusEl.classList.remove(
    "bg-slate-100",
    "text-slate-500",
    "bg-emerald-50",
    "text-emerald-700",
    "bg-amber-50",
    "text-amber-700",
  )
  statusEl.classList.add(...STATUS_COLORS[kind])
}

/**
 * Detect the extension and toggle the install prompt vs the demo. The content script
 * attaches its listener at document_idle, which can be after this page's first ping —
 * a single ping would be lost in that race, so poll a few times.
 */
async function detect(): Promise<void> {
  setStatus("Checking for the extension…", "checking")
  let ok = false
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    ok = await op.isAvailable()
    if (!ok) await sleep(200)
  }
  installEl.hidden = ok
  demoEl.hidden = !ok
  setStatus(ok ? "✓ Extension detected" : "✗ Extension not detected", ok ? "ok" : "warn")
}

async function pick(): Promise<void> {
  const url = urlInput.value.trim()
  if (!url) {
    showError("Enter a URL to pick in.")
    return
  }
  errorEl.hidden = true
  resultEl.hidden = true
  pickBtn.disabled = true
  pickBtn.textContent = "Picking…"
  try {
    const res = await op.pick({ url, screenshot: shotSel.value as ScreenshotMode })
    selectorEl.textContent = res.selector
    metaEl.textContent = `${res.matchCount} match${res.matchCount === 1 ? "" : "es"} · <${res.element.tag}>${
      res.element.text ? ` · "${res.element.text.slice(0, 40)}"` : ""
    }`
    if (res.screenshot) {
      shotImg.src = res.screenshot
      shotImg.hidden = false
    } else {
      shotImg.hidden = true
      shotImg.removeAttribute("src")
    }
    resultEl.hidden = false
  } catch (err) {
    if (err instanceof OpenpickerError) {
      showError(err.code === "cancelled" ? "Pick cancelled." : `Pick failed: ${err.code}`)
    } else {
      showError(`Pick failed: ${(err as Error).message}`)
    }
  } finally {
    pickBtn.disabled = false
    pickBtn.textContent = "Pick an element"
  }
}

function showError(message: string): void {
  errorEl.textContent = message
  errorEl.hidden = false
}

pickBtn.addEventListener("click", () => void pick())
recheckBtn.addEventListener("click", () => void detect())
copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(selectorEl.textContent ?? "").catch(() => {})
  copyBtn.textContent = "Copied"
  setTimeout(() => {
    copyBtn.textContent = "Copy"
  }, 1200)
})

void detect()
