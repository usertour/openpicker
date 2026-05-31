/**
 * Background service worker.
 *
 * Reserved for the extension-internal hop (PROTOCOL.md §1): per-origin consent
 * storage, screenshots, and cross-tab coordination. None of this is part of the
 * public protocol.
 *
 * For now it relays a toolbar icon click to the active tab's content script, which
 * toggles the demo overlay (used to verify the Shadow DOM + Tailwind foundation).
 */
export default defineBackground(() => {
  browser.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return
    browser.tabs.sendMessage(tab.id, { kind: "toggleOverlay" }).catch((error) => {
      // Expected when the content script is not present (e.g. chrome:// pages).
      console.debug("openpicker: could not reach content script", error)
    })
  })
})
