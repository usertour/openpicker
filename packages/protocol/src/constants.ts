/**
 * Fixed discriminator carried on every openpicker message. Receivers ignore any
 * message whose `channel` is not exactly this value.
 */
export const CHANNEL = "openpicker" as const
export type Channel = typeof CHANNEL

/** Protocol major version implemented by this package. See PROTOCOL.md §9. */
export const PROTOCOL_VERSION = 1 as const

/** The three message kinds that share the envelope. */
export type MessageKind = "req" | "res" | "evt"
