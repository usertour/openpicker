/**
 * Reverse lookup: highlight element(s) matching a selector without entering pick
 * mode (PROTOCOL.md §6.4). Plain DOM + rAF — no React — so it stays lightweight.
 */

let boxes: HTMLElement[] = []
let raf = 0
let tracked: Element[] = []

function ensureContainer(): HTMLElement {
  let host = document.getElementById("openpicker-highlight-host")
  if (!host) {
    host = document.createElement("div")
    host.id = "openpicker-highlight-host"
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646"
    document.documentElement.appendChild(host)
  }
  return host
}

function position(): void {
  for (let i = 0; i < tracked.length; i++) {
    const el = tracked[i]
    const box = boxes[i]
    if (!el || !box) continue
    const r = el.getBoundingClientRect()
    box.style.transform = `translate(${r.left}px, ${r.top}px)`
    box.style.width = `${r.width}px`
    box.style.height = `${r.height}px`
  }
  raf = requestAnimationFrame(position)
}

/** Highlight all elements matching `selector`. Returns the match count. */
export function runHighlight(selector: string): number {
  clearHighlight()
  let matches: Element[]
  try {
    matches = Array.from(document.querySelectorAll(selector))
  } catch {
    return 0
  }
  if (matches.length === 0) return 0

  const host = ensureContainer()
  tracked = matches
  boxes = matches.map(() => {
    const box = document.createElement("div")
    box.style.cssText =
      "position:absolute;top:0;left:0;border-radius:2px;box-shadow:0 0 0 2px rgba(59,130,246,0.9);transition:transform 80ms"
    host.appendChild(box)
    return box
  })
  matches[0]?.scrollIntoView({ block: "center", behavior: "smooth" })
  raf = requestAnimationFrame(position)
  return matches.length
}

/** Remove any active highlight. */
export function clearHighlight(): void {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  tracked = []
  boxes = []
  document.getElementById("openpicker-highlight-host")?.remove()
}
