/**
 * Background service worker — the extension-internal hop (PROTOCOL.md §1):
 * per-origin consent storage, screenshots, and cross-tab pick orchestration. None
 * of this is part of the public protocol, which is SDK ⇄ content script.
 */

type ConsentStatus = "granted" | "denied" | "ask"

type PickOutcome =
  | { type: "result"; result: unknown }
  | { type: "cancelled" }
  | { type: "denied" }

/** Wait until a tab has finished loading (status "complete"). */
function waitForTabComplete(tabId: number, timeoutMs = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      browser.tabs.onUpdated.removeListener(onUpdated)
      clearTimeout(timer)
      resolve(ok)
    }
    const onUpdated = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === "complete") finish(true)
    }
    browser.tabs.onUpdated.addListener(onUpdated)
    const timer = setTimeout(() => finish(false), timeoutMs)
    // Maybe it's already complete.
    browser.tabs.get(tabId).then((t) => {
      if (t.status === "complete") finish(true)
    })
  })
}

/**
 * Run a cross-tab pick: open `url` in a new tab next to the source, run the picker
 * there once it loads, then close the tab and refocus the source. See DESIGN.md §5c.
 */
async function runCrossTabPick(
  url: string,
  params: unknown,
  source: { tabId?: number; windowId?: number; index?: number },
): Promise<PickOutcome> {
  let targetTab: { id?: number } | undefined
  // If the user closes the target tab before finishing, resolve as cancelled.
  let onRemoved: ((id: number) => void) | undefined
  const removed = new Promise<PickOutcome>((resolve) => {
    onRemoved = (id: number) => {
      if (targetTab?.id !== undefined && id === targetTab.id) resolve({ type: "cancelled" })
    }
    browser.tabs.onRemoved.addListener(onRemoved)
  })

  try {
    targetTab = await browser.tabs.create({
      url,
      active: true,
      windowId: source.windowId,
      index: source.index === undefined ? undefined : source.index + 1,
    })
    const targetId = targetTab.id
    if (targetId === undefined) return { type: "cancelled" }

    const loaded = await waitForTabComplete(targetId)
    if (!loaded) return { type: "cancelled" }

    // Ask the target's content script to run the picker (consent already handled).
    const pick = browser.tabs
      .sendMessage(targetId, { kind: "crossTab:run", params })
      .then(
        (res) =>
          (res as { outcome?: PickOutcome })?.outcome ?? ({ type: "cancelled" } as PickOutcome),
      )
      .catch((): PickOutcome => ({ type: "cancelled" }))

    // Whichever happens first: the pick finishes, or the user closes the tab.
    const outcome = await Promise.race([pick, removed])
    return outcome
  } finally {
    if (onRemoved) browser.tabs.onRemoved.removeListener(onRemoved)
    if (targetTab?.id !== undefined) {
      try {
        await browser.tabs.remove(targetTab.id)
      } catch {
        // Already closed.
      }
    }
    // Refocus the source tab/window.
    if (source.tabId !== undefined) {
      try {
        await browser.tabs.update(source.tabId, { active: true })
        if (source.windowId !== undefined) {
          await browser.windows.update(source.windowId, { focused: true })
        }
      } catch {
        // Source gone; nothing to focus.
      }
    }
  }
}

const consentKey = (origin: string) => `consent:${origin}`

async function getConsent(origin: string): Promise<ConsentStatus> {
  const key = consentKey(origin)
  const stored = await browser.storage.local.get(key)
  const value = stored[key]
  return value === "granted" || value === "denied" ? value : "ask"
}

async function setConsent(origin: string, granted: boolean): Promise<void> {
  await browser.storage.local.set({ [consentKey(origin)]: granted ? "granted" : "denied" })
}

export default defineBackground(() => {
  // Toolbar icon → tell the active tab's content script to start a pick.
  browser.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return
    browser.tabs.sendMessage(tab.id, { kind: "startPick" }).catch((error) => {
      // Expected on pages without a content script (e.g. chrome:// URLs).
      console.debug("openpicker: could not reach content script", error)
    })
  })

  // Cross-tab pick: the source tab opens a long-lived port (which also keeps this
  // service worker alive for the duration). We open the URL, run the picker there,
  // and send the outcome back over the port. See DESIGN.md §5c.
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== "openpicker:crossTab") return
    const sourceTab = port.sender?.tab
    port.onMessage.addListener((msg: unknown) => {
      const m = msg as { kind?: string; url?: string; params?: unknown }
      if (m?.kind !== "crossTab:open" || !m.url) return
      runCrossTabPick(m.url, m.params, {
        tabId: sourceTab?.id,
        windowId: sourceTab?.windowId,
        index: sourceTab?.index,
      })
        .then((outcome) => {
          try {
            port.postMessage({ kind: "crossTab:outcome", outcome })
          } catch {
            // Source port already closed.
          }
        })
    })
  })

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    const msg = message as { kind?: string; granted?: boolean }
    const origin = sender.origin ?? (sender.url ? new URL(sender.url).origin : "")

    if (msg?.kind === "consent:get") {
      getConsent(origin).then((status) => sendResponse({ status }))
      return true // async response
    }
    if (msg?.kind === "consent:set") {
      setConsent(origin, !!msg.granted).then(() => sendResponse({ ok: true }))
      return true
    }
    if (msg?.kind === "screenshot") {
      const windowId = sender.tab?.windowId
      const capture =
        windowId === undefined
          ? browser.tabs.captureVisibleTab({ format: "png" })
          : browser.tabs.captureVisibleTab(windowId, { format: "png" })
      capture
        .then((dataUrl) => sendResponse({ dataUrl }))
        .catch(() => sendResponse({ dataUrl: null }))
      return true
    }
    return false
  })
})
