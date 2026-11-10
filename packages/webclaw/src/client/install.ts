/**
 * Client surfaces: `.webclaw` preview + Settings → 网站账号 + live sidebar.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from './slots-aug.ts'
import { AccountsSettings } from './AccountsSettings.tsx'
import {
  ACCOUNTS_NS,
  en as accountsEn,
  zh as accountsZh,
} from './accounts-locales.ts'
import { WEBCLAW_ICON_CSS } from './icons-css.ts'
import { LIVE_NS, en as liveEn, zh as liveZh } from './live-locales.ts'
import { en, NS, zh } from './locales.ts'
import {
  RUN_TOOL_NS,
  en as runToolEn,
  zh as runToolZh,
} from './run-tool-locales.ts'
import { WebclawLive } from './WebclawLive.tsx'
import {
  WEBCLAW_OPEN_LIVE_EVENT,
  type WebclawOpenLiveDetail,
} from './live-open.ts'
import { WebclawPreview } from './WebclawPreview.tsx'
import { WebclawRunToolview } from './WebclawRunToolview.tsx'

/** Document-preview implementation id (slot key). */
export const WEBCLAW_PREVIEW_ID = '@lonk1989/webclaw/recipe'

/** Settings section id for site accounts. */
export const WEBCLAW_ACCOUNTS_SECTION = 'webclaw-accounts'

/** Live sidebar tab implementation id. */
export const WEBCLAW_LIVE_ID = '@lonk1989/webclaw/live'

/** Live sidebar kind (openTab name). */
export const WEBCLAW_LIVE_KIND = 'webclaw-live'

const CANDIDATE_PORTS = [19229, 19230, 19231, 19232, 19233]

async function findLiveBase(): Promise<string | null> {
  for (const port of CANDIDATE_PORTS) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 400)
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) continue
      const j = (await res.json()) as { ok?: boolean; service?: string }
      if (j.ok && j.service === 'webclaw-accounts-ui') {
        return `http://127.0.0.1:${port}`
      }
    } catch {
      /* next */
    }
  }
  return null
}

/**
 * Register preview + accounts settings + live tab + file-tree icon CSS.
 * @param ctx - client root context.
 */
export function installWebclawSurfaces(ctx: Context): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-webclaw-icons', '')
    style.textContent = WEBCLAW_ICON_CSS
    document.head.appendChild(style)
    return () => {
      style.remove()
    }
  }, 'webclaw: file icons')

  ctx.inject(['documentPreviews', 'slots', 'locale'], scope => {
    scope.effect(
      () => scope.locale.register(NS, { zh, en }),
      'webclaw: preview dictionaries',
    )
    scope.effect(
      () => scope.locale.register(ACCOUNTS_NS, { zh: accountsZh, en: accountsEn }),
      'webclaw: accounts dictionaries',
    )
    scope.effect(
      () => scope.locale.register(LIVE_NS, { zh: liveZh, en: liveEn }),
      'webclaw: live dictionaries',
    )
    scope.effect(
      () => scope.locale.register(RUN_TOOL_NS, { zh: runToolZh, en: runToolEn }),
      'webclaw: run toolview dictionaries',
    )
    const t = scope.locale.bind(NS)
    const ta = scope.locale.bind(ACCOUNTS_NS)
    const tl = scope.locale.bind(LIVE_NS)

    // In-chat live log while webclaw_run is pending (DSH cannot stream execute()).
    scope.effect(
      () =>
        scope.slots.inject('tool.call.toolview', () =>
          scope.slots.register(
            {
              name: 'tool.call.toolview',
              key: 'webclaw_run',
              locale: RUN_TOOL_NS,
            },
            WebclawRunToolview,
          ),
        ),
      'webclaw: run toolview',
    )
    scope.effect(
      () =>
        scope.documentPreviews.register({
          id: WEBCLAW_PREVIEW_ID,
          extensions: ['webclaw'],
          priority: 'extension',
          title: () => t('title'),
          loading: 'text-pages',
          wrap: true,
        }),
      'webclaw: preview metadata',
    )
    scope.effect(
      () =>
        scope.slots.inject('sidebar.right.tab.document', () =>
          scope.slots.register(
            {
              name: 'sidebar.right.tab.document',
              key: WEBCLAW_PREVIEW_ID,
              locale: NS,
            },
            WebclawPreview,
          ),
        ),
      'webclaw: preview body',
    )
    // Soft: settings shell may be absent in minimal compositions.
    scope.effect(
      () =>
        scope.slots.inject('settings.section', () =>
          scope.slots.register(
            {
              name: 'settings.section',
              id: WEBCLAW_ACCOUNTS_SECTION,
              order: 45,
              label: () => ta('sectionLabel'),
              locale: ACCOUNTS_NS,
            },
            AccountsSettings,
          ),
        ),
      'webclaw: settings accounts',
    )

    // Live execution tab (optional: needs sidebarRightTabs).
    scope.inject(['sidebarRightTabs', 'sidebarRight', 'slots'], live => {
      live.effect(
        () =>
          live.sidebarRightTabs.register({
            id: WEBCLAW_LIVE_ID,
            kind: WEBCLAW_LIVE_KIND,
            priority: 'extension',
            title: () => tl('title'),
            guide: [
              {
                id: 'webclaw-live',
                order: 35,
                title: () => tl('guideTitle'),
                description: () => tl('guideDesc'),
              },
            ],
          }),
        'webclaw: live tab type',
      )
      live.effect(
        () =>
          live.slots.inject('sidebar.right.pane.tab', () =>
            live.slots.register(
              {
                name: 'sidebar.right.pane.tab',
                key: WEBCLAW_LIVE_ID,
                locale: LIVE_NS,
              },
              WebclawLive,
            ),
          ),
        'webclaw: live tab body',
      )

      // Poll Host focus marker → openTab with runDir.
      // Only advance lastSeq after openTab succeeds; retry while Session surface is cold.
      // Also honor toolview CustomEvent (fires while the agent card is on screen).
      live.effect(() => {
        let cancelled = false
        let lastOpenedSeq = -1
        let lastOpenedRunDir = ''
        let pendingRunDir = ''
        let base: string | null = null
        /** Leftover live-focus.json from a previous session must not yank the rail open. */
        let seededLeftoverFocus = false

        // If the user collapses the right rail, stop forcing it back open.
        let userCollapsedRail = false
        let everOpened = false

        const noteCollapsedIfAny = (): void => {
          try {
            const api = live.sidebarRight as { isExpanded?: () => boolean }
            if (everOpened && api.isExpanded && !api.isExpanded()) {
              userCollapsedRail = true
            }
          } catch {
            /* optional */
          }
        }

        const tryOpen = (runDir: string, seq: number, reveal: boolean): boolean => {
          try {
            noteCollapsedIfAny()
            const api = live.sidebarRight as {
              openTab: typeof live.sidebarRight.openTab
              isExpanded?: () => boolean
            }
            // After the user closes the rail, only refresh tab params quietly.
            const mayReveal = reveal && !userCollapsedRail
            api.openTab(WEBCLAW_LIVE_KIND, {
              params: { runDir, focusSeq: seq },
              revealIfOpened: mayReveal,
            })
            if (mayReveal) everOpened = true
            lastOpenedSeq = Math.max(lastOpenedSeq, seq)
            lastOpenedRunDir = runDir
            pendingRunDir = ''
            noteCollapsedIfAny()
            return true
          } catch {
            pendingRunDir = runDir
            return false
          }
        }

        const onOpenLive = (ev: Event) => {
          const detail = (ev as CustomEvent<WebclawOpenLiveDetail>).detail
          const runDir = detail?.runDir?.trim() || ''
          if (!runDir || cancelled) return
          noteCollapsedIfAny()
          // User closed the rail — don't yank it open from the tool card either.
          if (userCollapsedRail) return
          seededLeftoverFocus = true
          // Force a retry even when seq is unchanged (toolview saw runDir first).
          if (runDir !== lastOpenedRunDir) lastOpenedSeq = -1
          tryOpen(runDir, lastOpenedSeq + 1, true)
        }
        window.addEventListener(WEBCLAW_OPEN_LIVE_EVENT, onOpenLive)

        const poll = async () => {
          if (cancelled) return
          if (!base) base = await findLiveBase()
          if (!base || cancelled) return
          try {
            const res = await fetch(`${base}/api/live/focus`)
            const j = (await res.json()) as {
              ok?: boolean
              focus?: { runDir?: string; seq?: number }
            }
            const focus = j.focus
            const seq = typeof focus?.seq === 'number' ? focus.seq : -1
            const runDir = focus?.runDir?.trim() || pendingRunDir
            if (!runDir) return
            // Cold start: adopt disk leftover without revealing the right rail.
            if (!seededLeftoverFocus && !everOpened) {
              seededLeftoverFocus = true
              lastOpenedSeq = seq > 0 ? seq : 0
              lastOpenedRunDir = runDir
              return
            }
            // New runDir must reopen even if seq somehow stalled.
            if (runDir !== lastOpenedRunDir && seq <= lastOpenedSeq) {
              lastOpenedSeq = -1
            }
            if (seq <= lastOpenedSeq && runDir === lastOpenedRunDir && !pendingRunDir) {
              return
            }
            tryOpen(runDir, seq > 0 ? seq : lastOpenedSeq + 1, !userCollapsedRail)
          } catch {
            base = null
          }
        }
        void poll()
        const id = window.setInterval(() => {
          void poll()
        }, 600)
        return () => {
          cancelled = true
          window.clearInterval(id)
          window.removeEventListener(WEBCLAW_OPEN_LIVE_EVENT, onOpenLive)
        }
      }, 'webclaw: live focus poll')
    })
  })
}
