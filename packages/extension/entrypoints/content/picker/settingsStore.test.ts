import { fakeBrowser } from "@webext-core/fake-browser"
import { beforeEach, describe, expect, it } from "vitest"
import { defaultSelectorSettings, type SelectorSettings } from "./selectorSettings"
import {
  listSelectorOriginSettings,
  loadGlobalSelectorSettings,
  loadSelectorSettings,
  removeSelectorSettings,
  saveGlobalSelectorSettings,
  saveSelectorSettings,
} from "./settingsStore"

beforeEach(() => {
  fakeBrowser.reset()
})

function sample(): SelectorSettings {
  return { ...defaultSelectorSettings(), attr: { enabled: true, allow: "^data-step$", ignore: "" } }
}

describe("settingsStore — per origin", () => {
  it("returns null when nothing is stored", async () => {
    expect(await loadSelectorSettings("https://x.com")).toBeNull()
  })

  it("round-trips per-origin settings", async () => {
    const s = sample()
    saveSelectorSettings("https://x.com", s)
    expect(await loadSelectorSettings("https://x.com")).toEqual(s)
  })

  it("migrates a legacy stored shape on load", async () => {
    await browser.storage.local.set({
      "op:selectorSettings:https://x.com": {
        useIds: false,
        useClasses: true,
        useAttrs: true,
        ignoreId: "^ember",
        ignoreClass: "",
        attrAllow: "data-testid",
      },
    })
    expect(await loadSelectorSettings("https://x.com")).toEqual({
      id: { enabled: false, allow: "", ignore: "^ember" },
      class: { enabled: true, allow: "", ignore: "" },
      attr: { enabled: true, allow: "^(?:data-testid)$", ignore: "" },
      tag: { enabled: true, allow: "", ignore: "" },
    })
  })

  it("removes a per-origin override", async () => {
    saveSelectorSettings("https://x.com", sample())
    removeSelectorSettings("https://x.com")
    expect(await loadSelectorSettings("https://x.com")).toBeNull()
  })
})

describe("settingsStore — global default + listing", () => {
  it("round-trips the global default", async () => {
    const s = sample()
    saveGlobalSelectorSettings(s)
    expect(await loadGlobalSelectorSettings()).toEqual(s)
  })

  it("lists per-origin overrides and excludes the global default", async () => {
    saveGlobalSelectorSettings(defaultSelectorSettings())
    saveSelectorSettings("https://a.com", sample())
    saveSelectorSettings("https://b.com", defaultSelectorSettings())
    const list = await listSelectorOriginSettings()
    expect(Object.keys(list).sort()).toEqual(["https://a.com", "https://b.com"])
    expect(list["https://a.com"]).toEqual(sample())
  })
})
