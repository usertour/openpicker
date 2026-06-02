/**
 * Mount a Shadow DOM host for the picker UI, with the compiled Tailwind CSS
 * injected into the shadow root for style isolation.
 *
 * We mount manually rather than via WXT's createShadowRootUi so we control CSS
 * loading directly: fetch the web-accessible content CSS and inline it as a
 * <style> inside the shadow root. (createShadowRootUi pulled in a module-preload
 * helper that the bundler rewrote to import("chrome-extension://invalid/"), which
 * threw at runtime.) The host element is excluded from picking.
 */

const HOST_TAG = "openpicker-ui"
const CSS_PATH = "content-scripts/content.css"

let cachedCss: string | null = null

async function loadCss(): Promise<string> {
  if (cachedCss !== null) return cachedCss
  try {
    // CSS_PATH is a generated content-script asset, not in WXT's typed PublicPath.
    const url = (browser.runtime.getURL as (p: string) => string)(`/${CSS_PATH}`)
    const res = await fetch(url)
    cachedCss = withPropertyFallbacks(remToPx(await res.text()))
  } catch {
    cachedCss = ""
  }
  return cachedCss
}

/**
 * Tailwind v4 registers `--tw-*` vars (e.g. `--tw-border-style`) via `@property`,
 * but `@property` only registers at the document level — inside a shadow root it is
 * ignored, leaving those vars undefined. Utilities like `border-style:
 * var(--tw-border-style)` then resolve to nothing, so borders, rings, and shadows
 * silently disappear. Replay each `@property`'s `initial-value` as a plain custom
 * property on every element (the same fallback Tailwind ships for old browsers),
 * scoped to our shadow root so the host page is untouched.
 */
function withPropertyFallbacks(css: string): string {
  const decls: string[] = []
  const re = /@property\s+(--[\w-]+)\s*\{([^}]*)\}/g
  for (let m = re.exec(css); m; m = re.exec(css)) {
    const initial = m[2].match(/initial-value:\s*([^;]*)/)
    if (initial && initial[1].trim()) decls.push(`${m[1]}: ${initial[1].trim()};`)
  }
  if (decls.length === 0) return css
  return `*,::before,::after,::backdrop{${decls.join("")}}\n${css}`
}

/**
 * Convert `rem` units to fixed `px` (1rem = 16px). `rem` always resolves against
 * the host page's <html> font-size — even inside a shadow root — so without this
 * our UI's text and spacing would scale with whatever root font-size the page sets.
 * Pinning to px makes the picker render at consistent sizes on every site (browser
 * zoom, which scales px too, still works).
 */
function remToPx(css: string): string {
  return css.replace(/(-?[\d.]+)rem\b/g, (_m, n) => `${Number.parseFloat(n) * 16}px`)
}

export interface ShadowMount {
  /** The host element added to the page; pass to the picker so it's not targeted. */
  host: HTMLElement
  /** The container inside the shadow root to render React into. */
  container: HTMLElement
  /** Remove the host (and its shadow root) from the page. */
  remove: () => void
}

/** Create the shadow host and return its render container. */
export async function mountShadow(): Promise<ShadowMount> {
  const css = await loadCss()

  const host = document.createElement(HOST_TAG)
  host.style.cssText = "all: initial; position: absolute; z-index: 2147483647;"
  const shadow = host.attachShadow({ mode: "open" })

  if (css) {
    const style = document.createElement("style")
    style.textContent = css
    shadow.appendChild(style)
  }

  const container = document.createElement("div")
  shadow.appendChild(container)
  document.body.appendChild(host)

  return {
    host,
    container,
    remove: () => host.remove(),
  }
}
