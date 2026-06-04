import { CHANNEL, PROTOCOL_VERSION } from "@openpicker/protocol"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createOpenpicker, OpenpickerError } from "./index"

/**
 * The SDK is pure protocol plumbing over postMessage, so we inject a fake window
 * via `targetWindow` and drive both sides by hand: capture what the SDK posts, and
 * deliver synthetic `message` events back. No DOM/jsdom needed.
 */

interface Posted {
  data: unknown
  origin: string
}

interface ReqShape {
  channel: string
  v: number
  kind: string
  id: string
  method: string
  params: unknown
}

interface MockWindow {
  win: Window
  posted: Posted[]
  deliver: (data: unknown, opts?: { source?: unknown; origin?: string }) => void
  hasListener: () => boolean
}

function makeWindow(origin = "https://app.example.com"): MockWindow {
  let handler: ((event: MessageEvent) => void) | null = null
  const posted: Posted[] = []
  const win = {
    origin,
    addEventListener(_type: string, h: EventListenerOrEventListenerObject): void {
      handler = h as (event: MessageEvent) => void
    },
    removeEventListener(_type: string, h: EventListenerOrEventListenerObject): void {
      if (handler === (h as unknown as (event: MessageEvent) => void)) handler = null
    },
    postMessage(data: unknown, targetOrigin: string): void {
      posted.push({ data, origin: targetOrigin })
    },
  }
  const deliver = (data: unknown, opts?: { source?: unknown; origin?: string }): void => {
    if (!handler) throw new Error("the SDK registered no message listener")
    const event = {
      source: opts && "source" in opts ? opts.source : win,
      origin: opts?.origin ?? origin,
      data,
    } as unknown as MessageEvent
    handler(event)
  }
  return { win: win as unknown as Window, posted, deliver, hasListener: () => handler !== null }
}

function lastReq(posted: Posted[]): ReqShape {
  const last = posted.at(-1)
  if (!last) throw new Error("no request was posted")
  return last.data as ReqShape
}

function res(id: string, body: Record<string, unknown>): Record<string, unknown> {
  return { channel: CHANNEL, v: PROTOCOL_VERSION, kind: "res", id, ...body }
}

/** Await a promise expected to reject, returning the OpenpickerError. */
async function caught(promise: Promise<unknown>): Promise<OpenpickerError> {
  try {
    await promise
  } catch (error) {
    return error as OpenpickerError
  }
  throw new Error("expected the promise to reject, but it resolved")
}

afterEach(() => {
  vi.useRealTimers()
})

describe("request envelopes", () => {
  it("posts a well-formed envelope to the target origin", async () => {
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const promise = op.highlight("#a")
    const req = lastReq(m.posted)
    expect(req.channel).toBe(CHANNEL)
    expect(req.v).toBe(PROTOCOL_VERSION)
    expect(req.kind).toBe("req")
    expect(req.method).toBe("highlight")
    expect(req.params).toEqual({ selector: "#a" })
    expect(m.posted.at(-1)?.origin).toBe(m.win.origin)
    op.destroy()
    await caught(promise) // consume the destroy-time rejection
  })

  it("injects appName into ping and pick params", async () => {
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win, appName: "MyApp" })
    const ping = op.ping()
    expect(lastReq(m.posted).params).toEqual({ appName: "MyApp" })
    const pick = op.pick({ url: "https://target.example.com" })
    expect(lastReq(m.posted).method).toBe("pick")
    expect(lastReq(m.posted).params).toMatchObject({
      appName: "MyApp",
      url: "https://target.example.com",
    })
    op.destroy()
    await caught(ping)
    await caught(pick)
  })
})

describe("response correlation", () => {
  it("resolves the matching request with its result", async () => {
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const promise = op.highlight("#a")
    m.deliver(res(lastReq(m.posted).id, { ok: true, result: { count: 3 } }))
    await expect(promise).resolves.toEqual({ count: 3 })
    op.destroy()
  })

  it("routes concurrent requests to the right promise by id", async () => {
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const p1 = op.highlight("#a")
    const id1 = lastReq(m.posted).id
    const p2 = op.highlight("#b")
    const id2 = lastReq(m.posted).id
    expect(id1).not.toBe(id2)
    // Deliver out of order: second request first.
    m.deliver(res(id2, { ok: true, result: { count: 2 } }))
    m.deliver(res(id1, { ok: true, result: { count: 1 } }))
    await expect(p1).resolves.toEqual({ count: 1 })
    await expect(p2).resolves.toEqual({ count: 2 })
    op.destroy()
  })

  it("rejects with an OpenpickerError carrying code and data on ok:false", async () => {
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const promise = op.highlight("#a")
    m.deliver(
      res(lastReq(m.posted).id, {
        ok: false,
        error: { code: "consent_denied", message: "user said no", data: { origin: "x" } },
      }),
    )
    const error = await caught(promise)
    expect(error).toBeInstanceOf(OpenpickerError)
    expect(error.code).toBe("consent_denied")
    expect(error.message).toBe("user said no")
    expect(error.data).toEqual({ origin: "x" })
    op.destroy()
  })
})

describe("message filtering", () => {
  async function staysPending(deliverBad: (m: MockWindow, id: string) => void): Promise<void> {
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const promise = op.highlight("#a")
    let settled = false
    void promise.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )
    deliverBad(m, lastReq(m.posted).id)
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    op.destroy()
    expect((await caught(promise)).code).toBe("internal_error")
  }

  it("ignores responses from a foreign source window", async () => {
    await staysPending((m, id) => m.deliver(res(id, { ok: true, result: {} }), { source: {} }))
  })

  it("ignores responses from a different origin", async () => {
    await staysPending((m, id) =>
      m.deliver(res(id, { ok: true, result: {} }), { origin: "https://evil.example.com" }),
    )
  })

  it("ignores non-envelope and non-response messages", async () => {
    await staysPending((m, id) => {
      m.deliver({ hello: "world" })
      m.deliver({ channel: CHANNEL, v: PROTOCOL_VERSION, kind: "req", id, method: "ping" })
    })
  })

  it("ignores a response whose id matches nothing pending", async () => {
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const promise = op.highlight("#a") // registers the listener; leaves a real pending request
    let settled = false
    void promise.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )
    // A response with an unrelated id must be ignored, not throw or settle the request.
    expect(() => m.deliver(res("op:unknown:1", { ok: true, result: {} }))).not.toThrow()
    await Promise.resolve()
    expect(settled).toBe(false)
    op.destroy()
    expect((await caught(promise)).code).toBe("internal_error")
  })
})

describe("timeouts", () => {
  it("rejects quick operations after defaultTimeout", async () => {
    vi.useFakeTimers()
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const pending = caught(op.cancel())
    await vi.advanceTimersByTimeAsync(3000)
    expect((await pending).code).toBe("timeout")
    op.destroy()
  })

  it("maps a ping timeout to extension_not_installed", async () => {
    vi.useFakeTimers()
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win, pingTimeout: 100 })
    const pending = caught(op.ping())
    await vi.advanceTimersByTimeAsync(100)
    expect((await pending).code).toBe("extension_not_installed")
    op.destroy()
  })

  it("does not time out a pick (user-driven, unbounded)", async () => {
    vi.useFakeTimers()
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const promise = op.pick({ url: "https://target.example.com" })
    let settled = false
    void promise.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(settled).toBe(false)
    op.destroy()
    expect((await caught(promise)).code).toBe("internal_error")
  })
})

describe("isAvailable", () => {
  it("is true when the extension answers a ping", async () => {
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const promise = op.isAvailable()
    m.deliver(res(lastReq(m.posted).id, { ok: true, result: { version: 1, capabilities: [] } }))
    await expect(promise).resolves.toBe(true)
    op.destroy()
  })

  it("is false when the ping times out", async () => {
    vi.useFakeTimers()
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win, pingTimeout: 50 })
    const promise = op.isAvailable()
    await vi.advanceTimersByTimeAsync(50)
    await expect(promise).resolves.toBe(false)
    op.destroy()
  })
})

describe("isTargetOpen", () => {
  it("unwraps the result's open flag", async () => {
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const promise = op.isTargetOpen()
    m.deliver(res(lastReq(m.posted).id, { ok: true, result: { open: true } }))
    await expect(promise).resolves.toBe(true)
    op.destroy()
  })
})

describe("destroy", () => {
  it("removes the listener and rejects everything in flight", async () => {
    const m = makeWindow()
    const op = createOpenpicker({ targetWindow: m.win })
    const promise = op.highlight("#a")
    expect(m.hasListener()).toBe(true)
    op.destroy()
    expect(m.hasListener()).toBe(false)
    expect((await caught(promise)).code).toBe("internal_error")
  })
})
