/**
 * Background service worker.
 *
 * Reserved for the extension-internal hop (PROTOCOL.md §1): per-origin consent
 * storage, screenshots, and any cross-tab coordination. Nothing here is part of
 * the public protocol. Empty for now beyond a liveness log.
 */
export default defineBackground(() => {
  console.log("openpicker background ready")
})
