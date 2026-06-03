import type { ScreenshotMode } from "@openpicker/protocol"
import { requestScreenshot } from "./messaging"

/**
 * Produce a screenshot of the requested range. See DESIGN.md §5b.
 *
 * Browsers have no "screenshot one element" API: the background captures the
 * visible viewport (captureVisibleTab), and for "element" we crop that image to
 * the target's bounding rect on a canvas.
 *
 * captureVisibleTab snapshots the rendered pixels, so our own UI (sidebar,
 * highlight box, page dimming) would appear in the shot. We hide the picker's
 * shadow host for the duration of the capture, then restore it — mirroring the
 * proven pattern of un-rendering the selection UI before capturing.
 */

function raf2(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** Hide the picker's shadow host so it is not captured; returns a restore fn. */
function hidePickerUi(host: Element | null | undefined): () => void {
  if (!(host instanceof HTMLElement)) return () => {}
  const prev = host.style.display
  host.style.display = "none"
  return () => {
    host.style.display = prev
  }
}

/** Normalize the param (which also accepts booleans) to a ScreenshotMode. */
export function normalizeScreenshotMode(
  value: ScreenshotMode | boolean | undefined,
): ScreenshotMode {
  if (value === true) return "element"
  if (value === false || value === undefined) return "none"
  return value
}

function cropToElement(fullDataUrl: string, el: Element): Promise<string> {
  return new Promise((resolve, reject) => {
    const rect = el.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    const sx = rect.left * ratio
    const sy = rect.top * ratio
    const sw = Math.max(1, rect.width * ratio)
    const sh = Math.max(1, rect.height * ratio)

    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = sw
        canvas.height = sh
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("openpicker: no 2d context"))
          return
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
        resolve(canvas.toDataURL("image/png"))
      } catch (err) {
        reject(err as Error)
      }
    }
    img.onerror = () => reject(new Error("openpicker: failed to load capture"))
    img.src = fullDataUrl
  })
}

/**
 * Capture per the mode. For "element", scroll it into view first so it's within
 * the captured viewport, then crop. The picker UI (`host`) is hidden during the
 * capture so it is not in the shot. Returns undefined on "none" or on failure.
 */
export async function captureScreenshot(
  mode: ScreenshotMode,
  el: Element | null,
  host?: Element | null,
): Promise<string | undefined> {
  if (mode === "none") return undefined

  if (mode === "element" && el) {
    el.scrollIntoView({ block: "center", inline: "center" })
  }

  const restoreUi = hidePickerUi(host)
  try {
    // Let the scroll and the hidden UI settle (paint) before capturing.
    await raf2()
    const full = await requestScreenshot()
    if (!full) return undefined
    if (mode === "viewport" || !el) return full
    try {
      return await cropToElement(full, el)
    } catch {
      // Fall back to the full viewport image if cropping fails.
      return full
    }
  } finally {
    restoreUi()
  }
}
