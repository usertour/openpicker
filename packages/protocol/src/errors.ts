/** Stable error identifiers returned on a failed response. See PROTOCOL.md §8. */
export type ErrorCode =
  | "extension_not_installed"
  | "unsupported_protocol"
  | "consent_denied"
  | "cancelled"
  | "invalid_params"
  | "unsupported"
  | "timeout"
  | "internal_error"

/** Error payload carried on a failed response envelope (`ok: false`). */
export interface ProtocolError {
  code: ErrorCode
  message: string
  data?: unknown
}
