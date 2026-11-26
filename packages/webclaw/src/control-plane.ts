/**
 * Host control-plane helpers (parity with Python MCP jobs/status_fast):
 * busy / HITL / cancel marker / soft|hard reset — no lite spawn required for inspect.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import { join } from 'node:path'
import { cancelActiveHitl, hasActiveHitl, writeCancelMarker } from './spawn.js'
import { clearLiveFocus } from './live-focus.js'

export type AgentPhase =
  | 'idle'
  | 'running'
  | 'need_human'
  | 'busy'
  | 'cancelling'
  | 'cancelled'
  | 'done'

export interface NeedHumanSnap {
  readonly prompt_id?: string
  readonly kind?: string
  readonly hint?: string
  readonly run_dir?: string
  readonly inbox_image?: string
  readonly image_path?: string
}

export interface ActiveRunSnap {
  readonly id: string
  readonly status: string
  readonly startedAt?: string
  readonly runDir?: string
  readonly source: 'in_process' | 'jobs' | 'hitl_file'
}

export interface ControlPlaneSnapshot {
  readonly busy: boolean
  readonly activeRun: ActiveRunSnap | null
  readonly waitingHuman: boolean
  readonly needHuman: NeedHumanSnap | null
  readonly cancelMarkerPresent: boolean
  /** Ghost HITL / cancel marker with no live child — agent should reset. */
  readonly orphanRisk: boolean
}

export interface PreviewPaths {
  readonly runDir?: string
  readonly livePreviewPath?: string
  readonly captchaPath?: string
}

export interface ResetResult {
  ok: boolean
  code: string
  message: string
  before: ControlPlaneSnapshot
  after: ControlPlaneSnapshot
  actions: string[]
  hard: boolean
  browserStopRequested: boolean
}

function safeUnlink(path: string): boolean {
  try {
    if (!existsSync(path)) return false
    unlinkSync(path)
    return true
  } catch {
    return false
  }
}

function underHome(home: string, candidate: string): string | null {
  try {
    const homeNorm = home.replace(/[/\\]+$/, '')
    const resolved = candidate
    const a = homeNorm.toLowerCase().replace(/\\/g, '/')
    const b = resolved.toLowerCase().replace(/\\/g, '/')
    if (b === a || b.startsWith(`${a}/`)) return resolved
  } catch {
    /* ignore */
  }
  return null
}

/** Best-effort preview paths for agent/user visibility. */
export function previewPaths(home: string, runDir?: string | null): PreviewPaths {
  if (!runDir?.trim()) return {}
  let rd = runDir.trim()
  if (!rd.match(/[/\\]/)) {
    rd = join(home, 'runs', rd)
  }
  if (!underHome(home, rd)) {
    return { runDir: rd }
  }
  const live = join(rd, 'live-preview.png')
  const captcha = join(rd, 'human', 'captcha.png')
  return {
    runDir: rd,
    ...(existsSync(live) ? { livePreviewPath: live } : {}),
    ...(existsSync(captcha) ? { captchaPath: captcha } : {}),
  }
}

/** Attach phase / userMessage / preview (Python MCP envelope parity). */
export function attachPhasePreview(
  result: Record<string, any>,
  opts: { phase: AgentPhase; userMessage: string; home: string; runDir?: string | null },
): Record<string, any> {
  const preview = previewPaths(opts.home, opts.runDir)
  result.phase = opts.phase
  result.userMessage = opts.userMessage
  if (preview.runDir || preview.livePreviewPath || preview.captchaPath) {
    result.preview = preview
  }
  return result
}

function readNeedHumanFile(path: string, runDir: string): NeedHumanSnap | null {
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    const inbox =
      (typeof raw.inbox_image === 'string' && raw.inbox_image) ||
      (typeof raw.image_path === 'string' && raw.image_path) ||
      undefined
    return {
      prompt_id: typeof raw.prompt_id === 'string' ? raw.prompt_id : undefined,
      kind: typeof raw.kind === 'string' ? raw.kind : 'captcha',
      hint: typeof raw.hint === 'string' ? raw.hint : undefined,
      run_dir: runDir,
      inbox_image: inbox,
      image_path: inbox,
    }
  } catch {
    return { run_dir: runDir, kind: 'captcha' }
  }
}

function newestWaitingHuman(home: string): { path: string; runDir: string; mtime: number } | null {
  const runs = join(home, 'runs')
  if (!existsSync(runs)) return null
  let best: { path: string; runDir: string; mtime: number } | null = null
  try {
    for (const name of readdirSync(runs)) {
      const runDir = join(runs, name)
      const waiting = join(runDir, 'human', 'waiting_human.json')
      if (!existsSync(waiting)) continue
      let mtime = 0
      try {
        mtime = statSync(waiting).mtimeMs
      } catch {
        continue
      }
      if (!best || mtime > best.mtime) {
        best = { path: waiting, runDir, mtime }
      }
    }
  } catch {
    return null
  }
  return best
}

function readJobsActive(home: string): ActiveRunSnap | null {
  const jobsDir = join(home, 'jobs')
  if (!existsSync(jobsDir)) return null
  try {
    const files = readdirSync(jobsDir).filter(f => f.endsWith('.json'))
    if (files.length === 0) return null
    // Prefer newest by mtime.
    let best: { id: string; status: string; startedAt?: string; runDir?: string; mtime: number } | null =
      null
    for (const f of files) {
      const p = join(jobsDir, f)
      let mtime = 0
      try {
        mtime = statSync(p).mtimeMs
      } catch {
        continue
      }
      try {
        const row = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>
        const id = typeof row.id === 'string' ? row.id : f.replace(/\.json$/i, '')
        const status = typeof row.status === 'string' ? row.status : 'running'
        const startedAt =
          typeof row.started_at === 'string'
            ? row.started_at
            : typeof row.startedAt === 'string'
              ? row.startedAt
              : undefined
        const runDir =
          typeof row.run_dir === 'string'
            ? row.run_dir
            : typeof row.runDir === 'string'
              ? row.runDir
              : undefined
        if (!best || mtime > best.mtime) {
          best = { id, status, startedAt, runDir, mtime }
        }
      } catch {
        /* skip bad row */
      }
    }
    if (!best) return null
    return {
      id: best.id,
      status: best.status,
      startedAt: best.startedAt,
      runDir: best.runDir,
      source: 'jobs',
    }
  } catch {
    return null
  }
}

/**
 * Snapshot busy / HITL / cancel without spawning lite.
 * Pass `inProcessBusy` from hasActiveHitl() when available.
 */
export function inspectControlPlane(
  home: string,
  opts: { inProcessBusy?: boolean; activeRunDir?: string } = {},
): ControlPlaneSnapshot {
  const cancelMarkerPresent = existsSync(join(home, 'control', 'cancel'))
  const inProcess = opts.inProcessBusy === true || hasActiveHitl()
  const jobsActive = readJobsActive(home)
  const waitingFile = newestWaitingHuman(home)

  let activeRun: ActiveRunSnap | null = null
  let needHuman: NeedHumanSnap | null = null

  if (inProcess) {
    activeRun = {
      id: 'in-process',
      status: waitingFile ? 'need_human' : 'running',
      runDir: opts.activeRunDir || waitingFile?.runDir,
      source: 'in_process',
    }
  } else if (jobsActive) {
    activeRun = jobsActive
  }

  if (waitingFile) {
    needHuman = readNeedHumanFile(waitingFile.path, waitingFile.runDir)
    if (!activeRun) {
      // Ghost HITL on disk — report as active for agent visibility, mark orphan.
      activeRun = {
        id: 'hitl-file',
        status: 'need_human',
        runDir: waitingFile.runDir,
        source: 'hitl_file',
      }
    }
  } else if (jobsActive?.status === 'need_human' && jobsActive.runDir) {
    const p = join(jobsActive.runDir, 'human', 'waiting_human.json')
    if (existsSync(p)) needHuman = readNeedHumanFile(p, jobsActive.runDir)
    else needHuman = { run_dir: jobsActive.runDir, kind: 'captcha' }
  }

  const liveBusy = inProcess || jobsActive != null
  // Ghost HITL (file only) counts as busy so agents clear before a new run.
  const ghostHitl = !liveBusy && needHuman != null
  const waitingHuman = needHuman != null
  const orphanRisk =
    ghostHitl || (cancelMarkerPresent && !liveBusy)

  return {
    busy: liveBusy || ghostHitl,
    activeRun,
    waitingHuman,
    needHuman,
    cancelMarkerPresent,
    orphanRisk,
  }
}

/** Remove orphan waiting_human.json (keep current live run_dir when in-process HITL). */
export function clearStaleHitlMarkers(home: string, keepRunDir?: string): string[] {
  const cleared: string[] = []
  const runs = join(home, 'runs')
  if (!existsSync(runs)) return cleared
  const keep = keepRunDir?.trim()
  const live = hasActiveHitl()
  try {
    for (const name of readdirSync(runs)) {
      const runDir = join(runs, name)
      const waiting = join(runDir, 'human', 'waiting_human.json')
      if (!existsSync(waiting)) continue
      if (live && keep && (runDir === keep || underHome(home, keep) === runDir)) continue
      if (safeUnlink(waiting)) cleared.push(waiting)
    }
  } catch {
    /* ignore */
  }
  return cleared
}

export function clearCancelMarker(home: string): boolean {
  return safeUnlink(join(home, 'control', 'cancel'))
}

/**
 * Abandon stuck runs: cancel in-process → clear jobs/markers/HITL orphans.
 * hard=true only signals browserStopRequested; caller runs browser stop.
 */
export function resetHome(home: string, opts: { hard?: boolean } = {}): ResetResult {
  const hard = opts.hard === true
  const actions: string[] = []
  const before = inspectControlPlane(home)

  const hitlCancelled = cancelActiveHitl(home)
  actions.push(`cancelActiveHitl:${hitlCancelled}`)
  // Ensure lite siblings see cancel once, then drop the marker.
  writeCancelMarker(home)
  actions.push('write:control/cancel')

  const jobsDir = join(home, 'jobs')
  if (existsSync(jobsDir)) {
    try {
      for (const f of readdirSync(jobsDir)) {
        if (!f.endsWith('.json') && !f.endsWith('.cancel')) continue
        if (safeUnlink(join(jobsDir, f))) actions.push(`unlink:jobs/${f}`)
      }
    } catch {
      /* ignore */
    }
  }

  if (clearCancelMarker(home)) actions.push('unlink:control/cancel')

  // Force-clear all waiting_human (abandon HITL; no cross-session resume).
  const runs = join(home, 'runs')
  if (existsSync(runs)) {
    try {
      for (const name of readdirSync(runs)) {
        const waiting = join(runs, name, 'human', 'waiting_human.json')
        if (safeUnlink(waiting)) actions.push(`clear_hitl:${waiting}`)
      }
    } catch {
      /* ignore */
    }
  }

  try {
    clearLiveFocus(home)
    actions.push('clear:live-focus')
  } catch {
    /* ignore */
  }

  // Ensure control dir exists for subsequent runs.
  try {
    mkdirSync(join(home, 'control'), { recursive: true })
  } catch {
    /* ignore */
  }

  let after = inspectControlPlane(home)
  // After force-clear, busy should be false unless a brand-new job appeared.
  const ok = !after.busy && !after.waitingHuman && !after.cancelMarkerPresent
  return {
    ok,
    code: ok ? 'OK' : 'RUN_BUSY',
    message: ok
      ? 'Reset complete'
      : 'Reset requested but control plane still looks busy — try hard reset or webclaw_browser(stop)',
    before,
    after,
    actions,
    hard,
    browserStopRequested: hard,
  }
}

/** Merge control-plane fields onto a lite `status` JSON object. */
export function mergeStatusControlPlane(
  status: Record<string, any>,
  home: string,
): Record<string, any> {
  const control = inspectControlPlane(home)
  const need = control.needHuman
  const preview = previewPaths(home, need?.run_dir)
  const inbox = preview.captchaPath || preview.livePreviewPath || need?.inbox_image || null
  return {
    ...status,
    busy: control.busy,
    activeRun: control.activeRun,
    waitingHuman: control.waitingHuman,
    needHuman: control.needHuman,
    cancelMarkerPresent: control.cancelMarkerPresent,
    orphanRisk: control.orphanRisk,
    inboxImage: inbox,
    preview: Object.keys(preview).length ? preview : null,
    controlSource: 'host_ts',
  }
}
