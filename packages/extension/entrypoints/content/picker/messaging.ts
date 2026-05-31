import { browser } from "wxt/browser"

/** Talk to the background service worker for consent and screenshots. */

export type ConsentStatus = "granted" | "denied" | "ask"

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
