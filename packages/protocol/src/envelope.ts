import { CHANNEL, type Channel } from "./constants"
import type { ProtocolError } from "./errors"
import type { MethodMap, MethodName } from "./methods"

/** A method call: SDK → extension. See PROTOCOL.md §3. */
export interface RequestEnvelope<M extends MethodName = MethodName> {
  channel: Channel
  v: number
  kind: "req"
  id: string
  method: M
  params: MethodMap[M]["params"]
}

/** A reply to a request: extension → SDK. `id` echoes the request. */
export interface ResponseEnvelope<M extends MethodName = MethodName> {
  channel: Channel
  v: number
  kind: "res"
  id: string
  ok: boolean
  result?: MethodMap[M]["result"]
  error?: ProtocolError
}

/** Reserved notification names (none required in v1). See PROTOCOL.md §6.6. */
export type EventName = "hoverChange" | "consentChange"

/** A fire-and-forget notification, not correlated to a single request. */
export interface EventEnvelope {
  channel: Channel
  v: number
  kind: "evt"
  event: EventName
  data: unknown
}

export type Envelope = RequestEnvelope | ResponseEnvelope | EventEnvelope

/** Narrowing guard: is this an openpicker envelope at all? */
export function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return v.channel === CHANNEL && typeof v.kind === "string"
}
