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
    const res = await fetch(browser.runtime.getURL(`/${CSS_PATH}`))
    cachedCss = await res.text()
  } catch {
    cachedCss = ""
  }
  return cachedCss
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
