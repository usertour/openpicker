import { browser } from "wxt/browser"

/** Talk to the background service worker for consent and screenshots. */

export type ConsentStatus = "granted" | "denied" | "ask"

/**
 * How the picker authorizes a calling site. `allow-all` (default) = open, the user
 * picking + confirming is the safeguard; `ask` = prompt per origin and remember;
 * `blocklist` = open except origins marked denied. Set on the options page; the key
 * matches options/App.tsx. Read straight from storage (no background round-trip).
 */
export type AuthMode = "allow-all" | "ask" | "blocklist"

export async function getAuthMode(): Promise<AuthMode> {
  try {
    const v = (await browser.storage.local.get("authMode")).authMode
    return v === "ask" || v === "blocklist" ? v : "allow-all"
  } catch {
    return "allow-all"
  }
}

export async function getConsent(): Promise<ConsentStatus> {
  try {
    const res = (await browser.runtime.sendMessage({ kind: "consent:get" })) as
      | { status?: ConsentStatus }
      | undefined
    return res?.status ?? "ask"
  } catch {
    return "ask"
  }
}

export async function setConsent(granted: boolean): Promise<void> {
  try {
    await browser.runtime.sendMessage({ kind: "consent:set", granted })
  } catch {
    // Best effort; the picker still proceeds for this session.
  }
}

export async function requestScreenshot(): Promise<string | null> {
  try {
    const res = (await browser.runtime.sendMessage({ kind: "screenshot" })) as
      | { dataUrl?: string | null }
      | undefined
    return res?.dataUrl ?? null
  } catch {
    return null
  }
}
