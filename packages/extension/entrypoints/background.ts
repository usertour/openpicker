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

interface CrossTabParams {
  url?: string
  key?: string
  [k: string]: unknown
}

// --- Bidirectional source↔target tab map (DESIGN.md §5d) ---------------------
// Flat keys with the tabId encoded in the key give O(1) lookup from either side
// and let onRemoved clean up the matching pair precisely. Stored in
// storage.session so it survives the MV3 worker being recycled.

interface TargetEntry {
  sourceTabId: number
  url: string
  key?: string
}

const sourceToTargetKey = (sourceTabId: number) => `op:sourceToTarget:${sourceTabId}`
const targetToSourceKey = (targetTabId: number) => `op:targetToSource:${targetTabId}`

async function getMappedTargetId(sourceTabId: number): Promise<number | undefined> {
  const k = sourceToTargetKey(sourceTabId)
  const v = (await browser.storage.session.get(k))[k]
  return typeof v === "number" ? v : undefined
}

async function getTargetEntry(targetTabId: number): Promise<TargetEntry | undefined> {
  const k = targetToSourceKey(targetTabId)
  return (await browser.storage.session.get(k))[k] as TargetEntry | undefined
}

async function mapTabs(sourceTabId: number, targetTabId: number, entry: TargetEntry): Promise<void> {
  await browser.storage.session.set({
    [sourceToTargetKey(sourceTabId)]: targetTabId,
    [targetToSourceKey(targetTabId)]: entry,
  })
}

async function unmapByTarget(targetTabId: number): Promise<void> {
  const entry = await getTargetEntry(targetTabId)
  const keys = [targetToSourceKey(targetTabId)]
  if (entry) keys.push(sourceToTargetKey(entry.sourceTabId))
  await browser.storage.session.remove(keys)
}

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
 * Decide whether an existing target tab can be reused for this pick, mirroring the
 * proven cross-tab pattern: same host (and same caller `key`) → reuse; otherwise
 * open a new tab. The business-identity dimension is the caller-supplied opaque
 * `key`, since openpicker has no business concepts. See DESIGN.md §5d.
 */
async function findReusableTarget(
  sourceTabId: number,
  url: string,
  key: string | undefined,
): Promise<number | undefined> {
  const targetId = await getMappedTargetId(sourceTabId)
  if (targetId === undefined) return undefined

  let tab: { url?: string } | undefined
  try {
    tab = await browser.tabs.get(targetId)
  } catch {
    await unmapByTarget(targetId) // tab is gone; drop stale mapping
    return undefined
  }

  const entry = await getTargetEntry(targetId)
  if (!entry) return undefined
  // Different caller key → a different task → don't reuse.
  if ((entry.key ?? undefined) !== (key ?? undefined)) return undefined
  // Different host → don't reuse.
  try {
    if (tab.url && new URL(tab.url).host !== new URL(url).host) return undefined
  } catch {
    return undefined
  }
  return targetId
}

/**
 * Run a cross-tab pick: reuse the mapped target tab if it matches, else open `url`
 * in a new tab next to the source. Run the picker there once it loads, then
 * refocus the source tab — the target tab is NOT closed. See DESIGN.md §5c/§5d.
 */
async function runCrossTabPick(
  url: string,
  params: CrossTabParams,
  source: { tabId?: number; windowId?: number; index?: number },
): Promise<PickOutcome> {
  let targetId: number | undefined

  // Reuse an existing target tab when it matches (host + caller key).
  if (source.tabId !== undefined) {
    const reusable = await findReusableTarget(source.tabId, url, params.key)
    if (reusable !== undefined) {
      targetId = reusable
      try {
        await browser.tabs.update(reusable, { active: true, url })
        await waitForTabComplete(reusable)
      } catch {
        targetId = undefined // fall through to creating a new tab
      }
    }
  }

  // Otherwise open a new tab next to the source.
  if (targetId === undefined) {
    const created = await browser.tabs.create({
      url,
      active: true,
      windowId: source.windowId,
      index: source.index === undefined ? undefined : source.index + 1,
    })
    if (created.id === undefined) return { type: "cancelled" }
    targetId = created.id
    if (!(await waitForTabComplete(targetId))) return { type: "cancelled" }
  }

  // Record the mapping so results can route back and the tab can be reused.
  if (source.tabId !== undefined) {
    await mapTabs(source.tabId, targetId, { sourceTabId: source.tabId, url, key: params.key })
  }

  // If the user closes the target tab before finishing, resolve as cancelled.
  let onRemoved: ((id: number) => void) | undefined
  const removed = new Promise<PickOutcome>((resolve) => {
    onRemoved = (id: number) => {
      if (id === targetId) resolve({ type: "cancelled" })
    }
    browser.tabs.onRemoved.addListener(onRemoved)
  })

  try {
    // Ask the target's content script to run the picker (consent already handled).
    const pick = browser.tabs
      .sendMessage(targetId, { kind: "crossTab:run", params })
      .then(
        (res) =>
          (res as { outcome?: PickOutcome })?.outcome ?? ({ type: "cancelled" } as PickOutcome),
      )
      .catch((): PickOutcome => ({ type: "cancelled" }))

    // Whichever happens first: the pick finishes, or the user closes the tab.
    return await Promise.race([pick, removed])
  } finally {
    if (onRemoved) browser.tabs.onRemoved.removeListener(onRemoved)
    // Do NOT close the target tab — only refocus the source. The target stays open
    // for the user and for reuse by a follow-up pick.
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
      const m = msg as { kind?: string; url?: string; params?: CrossTabParams }
      if (m?.kind !== "crossTab:open" || !m.url) return
      runCrossTabPick(m.url, m.params ?? {}, {
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

  // Keep the source↔target map clean: when a mapped tab closes, drop its pair.
  browser.tabs.onRemoved.addListener(async (tabId) => {
    // The closed tab might be a target or a source; clear whichever pair it's in.
    await unmapByTarget(tabId)
    const mappedTarget = await getMappedTargetId(tabId)
    if (mappedTarget !== undefined) await unmapByTarget(mappedTarget)
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
