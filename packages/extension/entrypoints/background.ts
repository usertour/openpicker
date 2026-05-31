/**
 * Background service worker — the extension-internal hop (PROTOCOL.md §1):
 * per-origin consent storage and screenshots. None of this is part of the public
 * protocol, which is SDK ⇄ content script.
 */

type ConsentStatus = "granted" | "denied" | "ask"

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
      browser.tabs
        .captureVisibleTab(undefined, { format: "png" })
        .then((dataUrl) => sendResponse({ dataUrl }))
        .catch(() => sendResponse({ dataUrl: null }))
      return true
    }
    return false
  })
})
