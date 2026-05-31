import { useSyncExternalStore } from "react"

/**
 * Minimal external store for the content-script overlay state. The content entry
 * mutates it (e.g. when the toolbar icon is clicked or a `pick` starts); the React
 * overlay subscribes via {@link useOverlayState}.
 */
export interface OverlayState {
  /** Whether the picker overlay is currently shown. */
  active: boolean
}

let state: OverlayState = { active: false }
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function setOverlayState(patch: Partial<OverlayState>): void {
  state = { ...state, ...patch }
  emit()
}

export function getOverlayState(): OverlayState {
  return state
}

export function toggleActive(): void {
  setOverlayState({ active: !state.active })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** React hook: subscribe to the overlay state from within the Shadow DOM UI. */
export function useOverlayState(): OverlayState {
  return useSyncExternalStore(subscribe, getOverlayState)
}
