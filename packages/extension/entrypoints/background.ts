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
  params: CrossTabParams
}

/**
 * In-memory registry of cross-tab picks awaiting a result, keyed by source tab id.
 * Kept alive by the source tab's port. The result arrives as a `crossTab:result`
 * message (which survives target-tab navigation, unlike a sendMessage response)
 * and is routed here via the source↔target map. See DESIGN.md §5d phase 2.
 */
interface PendingPick {
  resolve: (outcome: PickOutcome) => void
  params: CrossTabParams
}
const pendingPicks = new Map<number, PendingPick>()

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

/**
 * Sweep the whole map and drop any entry whose tab no longer exists. The tabId is
 * encoded in the key, so we can check each one with `tabs.get`. This is a belt-and-
 * suspenders backstop to the precise `tabs.onRemoved` cleanup, run opportunistically
 * when a new target tab is created (covers any onRemoved we might have missed).
 */
async function sweepStaleMappings(): Promise<void> {
  const all = await browser.storage.session.get(null)
  const staleKeys: string[] = []
  for (const key of Object.keys(all)) {
    const match = key.match(/^op:(sourceToTarget|targetToSource):(\d+)$/)
    if (!match) continue
    const tabId = Number(match[2])
    try {
      await browser.tabs.get(tabId)
    } catch {
      staleKeys.push(key) // tab is gone
    }
  }
  if (staleKeys.length > 0) await browser.storage.session.remove(staleKeys)
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
    // Opportunistic backstop sweep when creating a new target (mirrors the
    // reference pattern's "clean on create"); complements tabs.onRemoved.
    await sweepStaleMappings()
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

  // A cross-tab pick needs a source tab to route the result back to.
  if (source.tabId === undefined) return { type: "cancelled" }
  const sourceTabId = source.tabId

  // Record the mapping so the result can route back and the tab can be reused.
  await mapTabs(sourceTabId, targetId, { sourceTabId, url, key: params.key, params })

  // The result is delivered later via a `crossTab:result` message (which survives
  // the target navigating), routed here through the map into pendingPicks. We also
  // settle if the user closes the target tab.
  let onRemoved: ((id: number) => void) | undefined
  try {
    const outcome = await new Promise<PickOutcome>((resolve) => {
      let settled = false
      const done = (o: PickOutcome) => {
        if (settled) return
        settled = true
        resolve(o)
      }
      pendingPicks.set(sourceTabId, { resolve: done, params })
      onRemoved = (id: number) => {
        if (id === targetId) done({ type: "cancelled" })
      }
      browser.tabs.onRemoved.addListener(onRemoved)
      // Tell the target to run the picker (it also writes a sessionStorage marker
      // so the pick can resume after navigation / in a same-origin new tab).
      browser.tabs
        .sendMessage(targetId, { kind: "crossTab:run", sourceTabId, params })
        .catch(() => {
          // Target not ready yet; it will say hello on load and we'll start it then.
        })
    })
    return outcome
  } finally {
    pendingPicks.delete(sourceTabId)
    if (onRemoved) browser.tabs.onRemoved.removeListener(onRemoved)
    // Do NOT close the target tab — only refocus the source. The target stays open
    // for the user and for reuse by a follow-up pick.
    try {
      await browser.tabs.update(sourceTabId, { active: true })
      if (source.windowId !== undefined) {
        await browser.windows.update(source.windowId, { focused: true })
      }
    } catch {
      // Source gone; nothing to focus.
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
    const msg = message as {
      kind?: string
      granted?: boolean
      sourceTabId?: number
      outcome?: PickOutcome
    }
    const origin = sender.origin ?? (sender.url ? new URL(sender.url).origin : "")
    const senderTabId = sender.tab?.id

    // A target tab reports a finished pick. Route it to the pending pick by the
    // source tab id (recovered from the map — survives target navigation).
    if (msg?.kind === "crossTab:result") {
      ;(async () => {
        let sourceTabId = msg.sourceTabId
        if (sourceTabId === undefined && senderTabId !== undefined) {
          sourceTabId = (await getTargetEntry(senderTabId))?.sourceTabId
        }
        if (sourceTabId !== undefined) {
          pendingPicks.get(sourceTabId)?.resolve(msg.outcome ?? { type: "cancelled" })
        }
        sendResponse({ ok: true })
      })()
      return true
    }

    // A target content script announces itself on load. If a pick is still pending
    // for its mapped source, tell it to (re)run with the original params — this is
    // how picking resumes after the target navigates. See DESIGN.md §5d phase 2.
    if (msg?.kind === "crossTab:hello") {
      ;(async () => {
        if (senderTabId === undefined) return sendResponse({ run: false })
        const entry = await getTargetEntry(senderTabId)
        if (entry && pendingPicks.has(entry.sourceTabId)) {
          sendResponse({ run: true, sourceTabId: entry.sourceTabId, params: entry.params })
        } else {
          sendResponse({ run: false })
        }
      })()
      return true
    }

    // Bring the calling tab to the foreground. A tab can only focus itself
    // (sender.tab), which is the safe boundary — no arbitrary tab can be raised.
    if (msg?.kind === "activateSelf") {
      ;(async () => {
        try {
          if (senderTabId !== undefined) await browser.tabs.update(senderTabId, { active: true })
          if (sender.tab?.windowId !== undefined) {
            await browser.windows.update(sender.tab.windowId, { focused: true })
          }
        } catch {
          // Tab/window gone.
        }
        sendResponse({ ok: true })
      })()
      return true
    }

    // Report whether the cross-tab target opened by this (source) tab is still open.
    if (msg?.kind === "isTargetOpen") {
      ;(async () => {
        let open = false
        if (senderTabId !== undefined) {
          const targetId = await getMappedTargetId(senderTabId)
          if (targetId !== undefined) {
            try {
              await browser.tabs.get(targetId)
              open = true
            } catch {
              await unmapByTarget(targetId) // stale; clean it
            }
          }
        }
        sendResponse({ open })
      })()
      return true
    }

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
