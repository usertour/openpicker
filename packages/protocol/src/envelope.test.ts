import { describe, expect, it } from "vitest"
import { CHANNEL } from "./constants"
import { isEnvelope } from "./envelope"

describe("isEnvelope", () => {
  it("accepts an object on the openpicker channel with a string kind", () => {
    expect(isEnvelope({ channel: CHANNEL, kind: "req" })).toBe(true)
    expect(isEnvelope({ channel: CHANNEL, kind: "res", id: "x", ok: true })).toBe(true)
    expect(isEnvelope({ channel: CHANNEL, kind: "evt", event: "hoverChange", data: 1 })).toBe(true)
  })

  it("rejects non-objects and null", () => {
    expect(isEnvelope(null)).toBe(false)
    expect(isEnvelope(undefined)).toBe(false)
    expect(isEnvelope("openpicker")).toBe(false)
    expect(isEnvelope(42)).toBe(false)
    expect(isEnvelope([])).toBe(false) // an array is an object but has no `channel`
  })

  it("rejects objects from a different channel", () => {
    expect(isEnvelope({ channel: "other", kind: "req" })).toBe(false)
    expect(isEnvelope({ kind: "req" })).toBe(false)
    expect(isEnvelope({})).toBe(false)
  })

  it("rejects when kind is missing or not a string", () => {
    expect(isEnvelope({ channel: CHANNEL })).toBe(false)
    expect(isEnvelope({ channel: CHANNEL, kind: 1 })).toBe(false)
    expect(isEnvelope({ channel: CHANNEL, kind: null })).toBe(false)
  })
})
