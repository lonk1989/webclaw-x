/**
 * Bridge: in-chat toolview (session surface) → live sidebar openTab poller.
 * CustomEvent keeps toolview free of a hard sidebarRight inject dependency.
 */

export const WEBCLAW_OPEN_LIVE_EVENT = 'webclaw:open-live'

export type WebclawOpenLiveDetail = {
  runDir: string
  /** Bump so the same runDir can re-trigger open after a failed attempt. */
  nonce?: number
}

/** Ask the root live poller to open/reveal the webclaw-live tab. */
export function requestOpenLive(runDir: string): void {
  const trimmed = runDir.trim()
  if (!trimmed || typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<WebclawOpenLiveDetail>(WEBCLAW_OPEN_LIVE_EVENT, {
      detail: { runDir: trimmed, nonce: Date.now() },
    }),
  )
}
