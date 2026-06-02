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
  /** Correlates the eventual result with the source's awaiting pick. */
  pickId?: string
}

// Cross-tab delivery is stateless: the source↔target mapping lives entirely in
// storage.session (above) and the result is routed back as a one-shot message
// (`crossTab:deliver`) looked up from that map. There is deliberately no in-memory
// registry of pending picks and no long-lived port — so the pick survives the MV3
// service worker being recycled mid-pick. Mirrors the proven cross-tab pattern.

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
 * Start a cross-tab pick: reuse the mapped target tab if it matches, else open
 * `url` in a new tab next to the source. Map source↔target (with `pickId`) and tell
 * the target to run the picker. Returns once the target is set up — it does NOT
 * await the result. The result is delivered later via `crossTab:result`, routed
 * back to the source by storage lookup, so it survives the worker being recycled.
 * See DESIGN.md §5c/§5d.
 */
async function startCrossTabPick(
  url: string,
  params: CrossTabParams,
  pickId: string,
  source: { tabId?: number; windowId?: number; index?: number },
): Promise<boolean> {
  // A cross-tab pick needs a source tab to route the result back to.
  if (source.tabId === undefined) return false
  const sourceTabId = source.tabId
  let targetId: number | undefined

  // Reuse an existing target tab when it matches (host + caller key).
  const reusable = await findReusableTarget(sourceTabId, url, params.key)
  if (reusable !== undefined) {
    targetId = reusable
    try {
      // Reuse: only focus the existing target tab — do NOT navigate it. The user
      // may have moved it elsewhere on the same host during a previous pick (via
      // "navigate to another page"), and forcing `url` would discard where they
      // went. Reuse is host-gated (findReusableTarget), so the tab is already on
      // the right host. Matches the proven cross-tab pattern. See DESIGN.md §5e.
      await browser.tabs.update(reusable, { active: true })
      await waitForTabComplete(reusable)
    } catch {
      targetId = undefined // fall through to creating a new tab
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
    if (created.id === undefined) return false
    targetId = created.id
    if (!(await waitForTabComplete(targetId))) return false
  }

  // Record the mapping so the result can route back and the tab can be reused.
  await mapTabs(sourceTabId, targetId, { sourceTabId, url, key: params.key, params, pickId })

  // Tell the target to run the picker (it also writes a sessionStorage marker so the
  // pick can resume after navigation). If it is not ready yet, it will say hello on
  // load and we start it then.
  browser.tabs.sendMessage(targetId, { kind: "crossTab:run", sourceTabId, params, pickId }).catch(() => {})
  return true
}

/**
 * Route a finished/aborted pick back to its source tab as a one-shot message. The
 * source content script resolves the awaiting `pick` when it sees the matching
 * `pickId`. Stateless: looked up from storage, so it works after a worker recycle.
 */
async function deliverToSource(
  sourceTabId: number,
  pickId: string | undefined,
  outcome: PickOutcome,
): Promise<void> {
  try {
    await browser.tabs.sendMessage(sourceTabId, { kind: "crossTab:deliver", pickId, outcome })
  } catch {
    // Source tab gone or has no listener; nothing to deliver to.
  }
}

/** Refocus a source tab (and its window) after its target reports a result. */
async function refocusSource(sourceTabId: number): Promise<void> {
  try {
    await browser.tabs.update(sourceTabId, { active: true })
    const tab = await browser.tabs.get(sourceTabId)
    if (tab.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true })
  } catch {
    // Source gone; nothing to focus.
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
  // The toolbar icon opens the popup (entrypoints/popup); its "Pick" button sends
  // `startPick` to the active tab's content script — so there is no action.onClicked.

  // Keep the source↔target map clean: when a mapped tab closes, drop its pair.
  browser.tabs.onRemoved.addListener(async (tabId) => {
    // If the closed tab was a target with a pick in flight, tell its source the pick
    // was cancelled (a stale pickId is simply ignored by the source).
    const entry = await getTargetEntry(tabId)
    if (entry) await deliverToSource(entry.sourceTabId, entry.pickId, { type: "cancelled" })
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
      url?: string
      params?: CrossTabParams
      pickId?: string
    }
    const origin = sender.origin ?? (sender.url ? new URL(sender.url).origin : "")
    const senderTabId = sender.tab?.id

    // A source tab asks to start a cross-tab pick. We open/reuse the target tab and
    // map it; the result is delivered later (crossTab:result → crossTab:deliver), so
    // this only acks whether the pick started. See DESIGN.md §5c.
    if (msg?.kind === "crossTab:open" && msg.url && msg.pickId) {
      ;(async () => {
        const ok = await startCrossTabPick(msg.url as string, msg.params ?? {}, msg.pickId as string, {
          tabId: senderTabId,
          windowId: sender.tab?.windowId,
          index: sender.tab?.index,
        })
        sendResponse({ ok })
      })()
      return true
    }

    // A target tab reports a finished pick. Route it back to the source tab by the
    // map (survives target navigation and a worker recycle), then refocus the source.
    if (msg?.kind === "crossTab:result") {
      ;(async () => {
        const entry = senderTabId !== undefined ? await getTargetEntry(senderTabId) : undefined
        const sourceTabId = entry?.sourceTabId ?? msg.sourceTabId
        const pickId = entry?.pickId ?? msg.pickId
        if (sourceTabId !== undefined) {
          await deliverToSource(sourceTabId, pickId, msg.outcome ?? { type: "cancelled" })
          // Do NOT close the target tab — keep it for the user and for reuse.
          await refocusSource(sourceTabId)
        }
        sendResponse({ ok: true })
      })()
      return true
    }

    // A target content script announces itself on load. If a pick is still mapped to
    // this tab, tell it to (re)run with the original params — this is how picking
    // resumes after the target navigates. The map (storage.session) is authoritative,
    // so resume works even after a worker recycle. See DESIGN.md §5d phase 2.
    if (msg?.kind === "crossTab:hello") {
      ;(async () => {
        const entry = senderTabId !== undefined ? await getTargetEntry(senderTabId) : undefined
        if (entry) {
          sendResponse({
            run: true,
            sourceTabId: entry.sourceTabId,
            params: entry.params,
            pickId: entry.pickId,
          })
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
