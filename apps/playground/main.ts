import { createOpenpicker, OpenpickerError } from "openpicker"

const out = document.getElementById("out") as HTMLPreElement
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

document.getElementById("ping")?.addEventListener("click", async () => {
  out.textContent = "pinging…"
  try {
    show("ping ok", await op.ping())
  } catch (error) {
    showError("ping", error)
  }
})

document.getElementById("pick")?.addEventListener("click", async () => {
  out.textContent = "picking…"
  try {
    show("pick ok", await op.pick({ mode: "unique" }))
  } catch (error) {
    showError("pick", error)
  }
})
