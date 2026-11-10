/**
 * Browser Client entry for `@lonk1989/webclaw`.
 * Host tools live in the package root; this half owns `.webclaw` preview UX.
 */
import type { Context } from '@deepseek-ai/cordis'
import { installWebclawSurfaces } from './install.ts'

/** Cordis client plugin id (same package as Host). */
export const name = 'webclaw'

/** Soft deps: preview registry arrives with sidebar-documentpreview. */
export const inject = ['slots', 'locale']

/**
 * Mount recipe preview, live sidebar tab, and file-tree icon tint.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  installWebclawSurfaces(ctx)
}

export {
  WEBCLAW_LIVE_ID,
  WEBCLAW_LIVE_KIND,
  WEBCLAW_PREVIEW_ID,
  installWebclawSurfaces,
} from './install.ts'
