// Explicit named re-exports (not `export *`): a barrel confuses the SDK's .d.ts
// bundler (rollup-plugin-dts) into emitting an unresolvable re-export. Listing each
// symbol lets it inline the declarations, and makes the public surface explicit.

export type { Channel, MessageKind } from "./constants"
export { CHANNEL, PROTOCOL_VERSION } from "./constants"
export type {
  Envelope,
  EventEnvelope,
  EventName,
  RequestEnvelope,
  ResponseEnvelope,
} from "./envelope"
export { isEnvelope } from "./envelope"

export type { ErrorCode, ProtocolError } from "./errors"

export type {
  ActivateSelfParams,
  ActivateSelfResult,
  CancelParams,
  CancelResult,
  ClearHighlightParams,
  ClearHighlightResult,
  HighlightParams,
  HighlightResult,
  IsTargetOpenParams,
  IsTargetOpenResult,
  MethodMap,
  MethodName,
  PickedElement,
  PickParams,
  PickResult,
  PingParams,
  PingResult,
  RegexSource,
  ScreenshotMode,
  SelectorAnchorConfig,
  SelectorConfig,
} from "./methods"
export type { SelectorToken, SelectorTokenType } from "./selectorTokens"
export { matchesSelectorConfig, tokenizeSelector } from "./selectorTokens"
