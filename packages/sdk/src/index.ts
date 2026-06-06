import {
  CHANNEL,
  type HighlightResult,
  isEnvelope,
  type MethodMap,
  type MethodName,
  type PickParams,
  type PickResult,
  type PingResult,
  PROTOCOL_VERSION,
  type ProtocolError,
  type RequestEnvelope,
} from "@openpicker/protocol"

/** Error thrown by the SDK; carries a stable {@link ProtocolError.code}. */
export class OpenpickerError extends Error {
  readonly code: ProtocolError["code"]
  readonly data?: unknown

  constructor(error: ProtocolError) {
    super(error.message)
    this.name = "OpenpickerError"
    this.code = error.code
    this.data = error.data
  }
}

export interface OpenpickerOptions {
  /** Display name shown in the extension's consent prompt (never trusted for auth). */
  appName?: string
  /** Timeout for `ping` before assuming the extension is not installed. Default 1500ms. */
  pingTimeout?: number
  /** Timeout for quick operations (cancel/highlight/clearHighlight). Default 3000ms. */
  defaultTimeout?: number
  /** Window to communicate over. Defaults to the global `window`. */
  targetWindow?: Window
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timer: ReturnType<typeof setTimeout> | undefined
}

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

function randomId(length: number): string {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  let out = ""
  for (const byte of bytes) {
    out += ID_ALPHABET[byte % ID_ALPHABET.length]
  }
  return out
}

/**
 * A handle to the openpicker browser extension. Construct one per integration via
 * {@link createOpenpicker}; call {@link Openpicker.destroy} when done.
 */
export class Openpicker {
  private readonly options: OpenpickerOptions
  private readonly win: Window
  private readonly instanceId = randomId(6)
  private readonly pending = new Map<string, Pending>()
  private seq = 0
  private listening = false

  constructor(options: OpenpickerOptions = {}) {
    this.options = options
    this.win = options.targetWindow ?? window
  }

  private onMessage = (event: MessageEvent): void => {
    // Only accept messages from this same window and origin (PROTOCOL.md §2).
    if (event.source !== this.win) return
    if (event.origin !== this.win.origin) return
    const data = event.data
    if (!isEnvelope(data) || data.kind !== "res") return

    const entry = this.pending.get(data.id)
    if (!entry) return
    this.pending.delete(data.id)
    if (entry.timer) clearTimeout(entry.timer)

    if (data.ok) {
      entry.resolve(data.result)
    } else {
      entry.reject(
        new OpenpickerError(
          data.error ?? { code: "internal_error", message: "openpicker: malformed error response" },
        ),
      )
    }
  }

  private ensureListening(): void {
    if (this.listening) return
    this.win.addEventListener("message", this.onMessage)
    this.listening = true
  }

  private request<M extends MethodName>(
    method: M,
    params: MethodMap[M]["params"],
    timeout: number,
  ): Promise<MethodMap[M]["result"]> {
    this.ensureListening()
    const id = `op:${this.instanceId}:${++this.seq}`
    const envelope: RequestEnvelope<M> = {
      channel: CHANNEL,
      v: PROTOCOL_VERSION,
      kind: "req",
      id,
      method,
      params,
    }

    return new Promise<MethodMap[M]["result"]>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      if (timeout > 0) {
        timer = setTimeout(() => {
          this.pending.delete(id)
          reject(
            new OpenpickerError({
              code: "timeout",
              message: `openpicker: "${method}" timed out after ${timeout}ms`,
            }),
          )
        }, timeout)
      }
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      })
      this.win.postMessage(envelope, this.win.origin)
    })
  }

  /** Probe the extension and negotiate version/capabilities. */
  async ping(): Promise<PingResult> {
    try {
      return await this.request(
        "ping",
        { appName: this.options.appName },
        this.options.pingTimeout ?? 1500,
      )
    } catch (error) {
      if (error instanceof OpenpickerError && error.code === "timeout") {
        throw new OpenpickerError({
          code: "extension_not_installed",
          message: "openpicker: the extension is not installed or did not respond",
        })
      }
      throw error
    }
  }

  /** Convenience: resolve `true` if the extension responds to a ping. */
  async isAvailable(): Promise<boolean> {
    try {
      await this.ping()
      return true
    } catch {
      return false
    }
  }

  /**
   * Open `params.url` in a tab and start element selection there; resolves when the
   * user confirms (OK) in the sidebar. `url` is required — the extension picks
   * across the tab/origin boundary, which is the thing a page can't do for itself.
   */
  pick(params: PickParams): Promise<PickResult> {
    // No timeout: a pick is user-driven and may take arbitrarily long.
    return this.request("pick", { appName: this.options.appName, ...params }, 0)
  }

  /** Cancel an in-flight pick. */
  async cancel(): Promise<void> {
    await this.request("cancel", {}, this.options.defaultTimeout ?? 3000)
  }

  /** Highlight element(s) matching a selector without entering pick mode. */
  highlight(selector: string): Promise<HighlightResult> {
    return this.request("highlight", { selector }, this.options.defaultTimeout ?? 3000)
  }

  /** Remove any active highlight. */
  async clearHighlight(): Promise<void> {
    await this.request("clearHighlight", {}, this.options.defaultTimeout ?? 3000)
  }

  /** Bring the calling tab to the foreground (a tab can only focus itself). */
  async activateSelf(): Promise<void> {
    await this.request("activateSelf", {}, this.options.defaultTimeout ?? 3000)
  }

  /** Whether the cross-tab target tab opened by this tab is still open. */
  async isTargetOpen(): Promise<boolean> {
    const { open } = await this.request("isTargetOpen", {}, this.options.defaultTimeout ?? 3000)
    return open
  }

  /** Stop listening and reject any in-flight requests. */
  destroy(): void {
    if (this.listening) {
      this.win.removeEventListener("message", this.onMessage)
      this.listening = false
    }
    for (const entry of this.pending.values()) {
      if (entry.timer) clearTimeout(entry.timer)
      entry.reject(
        new OpenpickerError({ code: "internal_error", message: "openpicker: instance destroyed" }),
      )
    }
    this.pending.clear()
  }
}

/** Create an {@link Openpicker} handle. */
export function createOpenpicker(options?: OpenpickerOptions): Openpicker {
  return new Openpicker(options)
}

export type {
  HighlightResult,
  PickedElement,
  PickParams,
  PickResult,
  PingResult,
  ProtocolError,
  RegexSource,
  ScreenshotMode,
  SelectorAnchorConfig,
  SelectorConfig,
  SelectorToken,
  SelectorTokenType,
} from "@openpicker/protocol"
/** Validate a returned selector against a {@link SelectorConfig} (the user may have edited it). */
export { matchesSelectorConfig } from "@openpicker/protocol"
