/**
 * Soft slot contracts for Settings / toolview when optional peers are present.
 */
import type { ReactNode } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'settings.section': {
      kind: 'list'
      scope: 'root'
      owner: {
        id: string
        order?: number
        label?: string | (() => string)
        children?: ReactNode
      }
    }
    /**
     * Declared by `@deepseek-ai/dsh-client-ui-tool`. Re-stated so webclaw can
     * register without hard-depending on that package at compile time.
     */
    'tool.call.toolview': {
      kind: 'keyed'
      scope: 'session'
      owner: {
        useDisclosure: unknown
        callId: string
        toolName: string
        cwd?: string | undefined
        home?: string | undefined
        openFile: (path: string, options?: { line?: number }) => void
        loadImage: unknown
        inspect?: (() => void) | undefined
      } & (
        | { readonly phase: 'preparing'; readonly block: { argsRaw?: string } }
        | { readonly phase: 'start'; readonly block: { argsRaw?: string } }
        | {
            readonly phase: 'result'
            readonly block: {
              content?: readonly { type: string; text?: string }[]
              meta?: unknown
              isError?: boolean
              call?: { name: string; argsRaw: string } | null
              error?: { name: string; code: string; reason?: string }
            }
          }
      )
    }
  }
}

declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
  interface SidebarRightTabParamsMap {
    /** Open webclaw live preview for a run directory under WEBCLAW_HOME. */
    'webclaw-live': { runDir?: string; focusSeq?: number }
  }
}
