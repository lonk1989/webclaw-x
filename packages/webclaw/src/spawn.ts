/**
 * Spawn webclaw-lite and capture stdout/stderr.
 *
 * Supports Host Stop (AbortSignal → cancel marker + kill) and early HITL
 * (return on need_human while keeping the child for human_reply resume).
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ingestLiveLogChunk, resetLiveLog } from './live-focus.js'

const OUTPUT_CAP = 2 * 1024 * 1024

export interface SpawnResult {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  /** True when resolved early on need_human; child still running until resume/cancel. */
  readonly earlyHitl?: boolean
  readonly needHuman?: Record<string, unknown>
  readonly run_dir?: string
  readonly cancelled?: boolean
}

export interface LiteEnv {
  readonly binaryPath: string
  readonly webclawHome?: string
  readonly liteBaseUrl?: string
  readonly timeoutMs?: number
}

export interface RunLiteOptions {
  readonly signal?: AbortSignal
  /** Return on first need_human JSONL event; keep child for resume. Default true for run. */
  readonly earlyHitl?: boolean
  /** Called once when run_dir first appears in JSONL (for live sidebar). */
  readonly onRunDir?: (runDir: string) => void
  /**
   * Mirror JSONL log lines to control/live-log.json for the in-chat toolview.
   * Default true for `run` argv; false for status/probe/etc.
   */
  readonly liveLog?: boolean
}

type ActiveHitl = {
  child: ChildProcess
  stdout: string
  stderr: string
  home: string
  binaryPath: string
  timer: NodeJS.Timeout | null
  settled: boolean
  resolve: (r: SpawnResult) => void
  buffer: string
}

let activeHitl: ActiveHitl | null = null

function resolveHome(env: LiteEnv): string {
  const fromCfg = env.webclawHome?.trim()
  if (fromCfg) return fromCfg
  const fromEnv = process.env.WEBCLAW_HOME?.trim()
  if (fromEnv) return fromEnv
  const local = process.env.LOCALAPPDATA?.trim()
  if (local) return join(local, 'webclaw')
  return join(process.env.HOME || process.env.USERPROFILE || tmpdir(), '.webclaw')
}

/** Write control/cancel so lite's AtomicBool polls pick it up quickly. */
export function writeCancelMarker(home: string): void {
  try {
    const dir = join(home, 'control')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'cancel'), '1\n', { encoding: 'utf8' })
  } catch {
    /* best-effort */
  }
}

function killChildTree(child: ChildProcess): void {
  const pid = child.pid
  if (pid == null) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      })
    } else {
      try {
        process.kill(-pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
      setTimeout(() => {
        try {
          process.kill(-pid, 'SIGKILL')
        } catch {
          try {
            child.kill('SIGKILL')
          } catch {
            /* ignore */
          }
        }
      }, 800)
    }
  } catch {
    try {
      child.kill()
    } catch {
      /* ignore */
    }
  }
}

/** Cancel in-flight early-HITL child (Host Stop / webclaw_cancel). */
export function cancelActiveHitl(home?: string): boolean {
  const hitl = activeHitl
  if (!hitl) {
    if (home) writeCancelMarker(home)
    return false
  }
  writeCancelMarker(hitl.home)
  if (hitl.timer) clearTimeout(hitl.timer)
  killChildTree(hitl.child)
  if (!hitl.settled) {
    hitl.settled = true
    hitl.resolve({
      code: null,
      stdout: hitl.stdout,
      stderr: hitl.stderr,
      cancelled: true,
      run_dir: extractRunDir(hitl.stdout),
    })
  }
  activeHitl = null
  return true
}

function parentOfHumanFile(path: string): string | undefined {
  const m = path.trim().match(/^(.*)[/\\]human[/\\][^/\\]+$/i)
  return m?.[1]
}

/** Pull run_dir from a log message like `run_dir=C:\...\runs\task-… human_dir=…`. */
function runDirFromLogMessage(message: string): string | undefined {
  const m = message.match(/(?:^|\s)run_dir=([^\s]+)/i)
  const raw = m?.[1]?.trim()
  return raw || undefined
}

function extractRunDir(stdout: string): string | undefined {
  const lines = stdout.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim()
    if (!line) continue
    // Human header: `… | 产物目录: C:\…\runs\task-…`
    const fromHeader = line.match(/产物目录:\s*(.+?)\s*$/)
    if (fromHeader?.[1]?.trim()) return fromHeader[1].trim()
    if (!line.startsWith('{')) continue
    try {
      const row = JSON.parse(line) as {
        type?: string
        run_dir?: string
        message?: string
        reply_file?: string
        image_path?: string
        inbox_image?: string
      }
      if (row.run_dir?.trim()) return row.run_dir.trim()
      if (typeof row.message === 'string') {
        const fromMsg = runDirFromLogMessage(row.message)
        if (fromMsg) return fromMsg
      }
      for (const p of [row.reply_file, row.image_path, row.inbox_image]) {
        if (p?.trim()) {
          const dir = parentOfHumanFile(p)
          if (dir) return dir
        }
      }
    } catch {
      continue
    }
  }
  return undefined
}

function parseNeedHuman(line: string): Record<string, unknown> | undefined {
  if (!line.includes('need_human')) return undefined
  try {
    const row = JSON.parse(line) as Record<string, unknown>
    if (row.type === 'need_human') return row
  } catch {
    /* ignore */
  }
  return undefined
}

function buildChildEnv(env: LiteEnv): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = { ...process.env }
  if (env.webclawHome?.trim()) {
    childEnv.WEBCLAW_HOME = env.webclawHome.trim()
  }
  if (env.liteBaseUrl?.trim()) {
    childEnv.WEBCLAW_LITE_BASE = env.liteBaseUrl.trim()
  }
  childEnv.WEBCLAW_LITE = childEnv.WEBCLAW_LITE || '1'
  // Default headless for DSH / Host unless caller already set WEBCLAW_HEADLESS.
  if (!childEnv.WEBCLAW_HEADLESS?.trim()) {
    childEnv.WEBCLAW_HEADLESS = '1'
  }
  // OCR try-fill+submit by default so login closes without parking on HITL confirm.
  // Set WEBCLAW_CAPTCHA_OCR_SUBMIT=0 to keep fill-only.
  if (!childEnv.WEBCLAW_CAPTCHA_OCR_SUBMIT?.trim()) {
    childEnv.WEBCLAW_CAPTCHA_OCR_SUBMIT = '1'
  }
  return childEnv
}

/**
 * Run webclaw-lite with argv; merges WEBCLAW_* env.
 * Pass `signal` so Host Stop aborts the child; pass `earlyHitl:true` for captcha pause.
 */
export function runLite(
  env: LiteEnv,
  args: readonly string[],
  options: RunLiteOptions = {},
): Promise<SpawnResult> {
  const timeoutMs = env.timeoutMs ?? 600_000
  const home = resolveHome(env)
  const childEnv = buildChildEnv(env)
  const earlyHitl = options.earlyHitl === true
  const signal = options.signal

  if (signal?.aborted) {
    writeCancelMarker(home)
    return Promise.resolve({
      code: null,
      stdout: '',
      stderr: 'aborted before spawn',
      cancelled: true,
    })
  }

  // A new blocking run supersedes a stale HITL handle.
  if (!earlyHitl && activeHitl) {
    cancelActiveHitl(home)
  }

  return new Promise(resolve => {
    const child = spawn(env.binaryPath, [...args], {
      env: childEnv,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    let lineBuf = ''
    let timer: NodeJS.Timeout | null = null
    let runDirNotified = false
    const onRunDir = options.onRunDir
    const liveLog = options.liveLog === true || args[0] === 'run'
    const liveLogState = { buf: '' }
    if (liveLog) {
      resetLiveLog(home)
    }

    const notifyRunDir = (dir: string): void => {
      if (runDirNotified || !onRunDir) return
      const trimmed = dir.trim()
      if (!trimmed) return
      runDirNotified = true
      try {
        onRunDir(trimmed)
      } catch {
        /* ignore */
      }
    }

    const maybeNotifyFromStdout = (): void => {
      const dir = extractRunDir(stdout)
      if (dir) notifyRunDir(dir)
    }

    const finish = (result: SpawnResult): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      if (activeHitl?.child === child) activeHitl = null
      if (result.run_dir) notifyRunDir(result.run_dir)
      else maybeNotifyFromStdout()
      try {
        child.stdout?.destroy()
      } catch {
        /* ignore */
      }
      try {
        child.stderr?.destroy()
      } catch {
        /* ignore */
      }
      resolve(result)
    }

    const onAbort = (): void => {
      writeCancelMarker(home)
      killChildTree(child)
      finish({
        code: null,
        stdout,
        stderr: stderr || 'cancelled by host stop',
        cancelled: true,
        run_dir: extractRunDir(stdout),
      })
    }

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
    }

    timer = setTimeout(() => {
      writeCancelMarker(home)
      killChildTree(child)
      finish({ code: null, stdout, stderr: stderr || 'timeout', run_dir: extractRunDir(stdout) })
    }, timeoutMs)

    const ingestStdout = (chunk: string): void => {
      if (stdout.length < OUTPUT_CAP) {
        stdout += chunk.slice(0, OUTPUT_CAP - stdout.length)
      }
      maybeNotifyFromStdout()
      if (liveLog) {
        ingestLiveLogChunk(home, chunk, liveLogState, extractRunDir(stdout))
      }
      if (!earlyHitl || settled) return
      lineBuf += chunk
      let nl: number
      while ((nl = lineBuf.indexOf('\n')) >= 0) {
        const line = lineBuf.slice(0, nl).replace(/\r$/, '').trim()
        lineBuf = lineBuf.slice(nl + 1)
        if (!line) continue
        const need = parseNeedHuman(line)
        if (!need) continue
        // Park child for human_reply resume; do not destroy stdio yet.
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        signal?.removeEventListener('abort', onAbort)
        activeHitl = {
          child,
          stdout,
          stderr,
          home,
          binaryPath: env.binaryPath,
          timer: setTimeout(() => {
            cancelActiveHitl(home)
          }, Math.max(60_000, timeoutMs)),
          settled: false,
          resolve: r => finish(r),
          buffer: lineBuf,
        }
        // Keep reading in background into activeHitl buffers.
        child.stdout?.removeAllListeners('data')
        child.stderr?.removeAllListeners('data')
        child.stdout?.on('data', (c: Buffer) => {
          if (!activeHitl || activeHitl.child !== child) return
          const t = c.toString('utf8')
          if (activeHitl.stdout.length < OUTPUT_CAP) {
            activeHitl.stdout += t.slice(0, OUTPUT_CAP - activeHitl.stdout.length)
          }
          if (liveLog) {
            ingestLiveLogChunk(home, t, liveLogState, extractRunDir(activeHitl.stdout))
          }
        })
        child.stderr?.on('data', (c: Buffer) => {
          if (!activeHitl || activeHitl.child !== child) return
          const t = c.toString('utf8')
          if (activeHitl.stderr.length < OUTPUT_CAP) {
            activeHitl.stderr += t.slice(0, OUTPUT_CAP - activeHitl.stderr.length)
          }
        })
        child.removeAllListeners('exit')
        child.on('exit', (code, sig) => {
          const hitl = activeHitl
          if (!hitl || hitl.child !== child || hitl.settled) return
          hitl.settled = true
          if (hitl.timer) clearTimeout(hitl.timer)
          activeHitl = null
          hitl.resolve({
            code: code ?? (sig ? null : 0),
            stdout: hitl.stdout,
            stderr: hitl.stderr,
            run_dir: extractRunDir(hitl.stdout),
          })
        })
        settled = true
        resolve({
          code: null,
          stdout,
          stderr,
          earlyHitl: true,
          needHuman: need,
          run_dir: extractRunDir(stdout),
        })
        return
      }
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      ingestStdout(chunk.toString('utf8'))
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < OUTPUT_CAP) {
        stderr += chunk.toString('utf8').slice(0, OUTPUT_CAP - stderr.length)
      }
    })
    child.on('error', () => {
      finish({ code: null, stdout, stderr })
    })
    child.on('exit', (code, sig) => {
      finish({
        code: code ?? (sig ? null : 0),
        stdout,
        stderr,
        run_dir: extractRunDir(stdout),
      })
    })
  })
}

/**
 * After webclaw_human_reply wrote the file, wait for the parked run to finish
 * (or hit another need_human).
 */
export function resumeActiveHitl(
  options: RunLiteOptions = {},
): Promise<SpawnResult | null> {
  const hitl = activeHitl
  if (!hitl) return Promise.resolve(null)

  const signal = options.signal
  if (signal?.aborted) {
    cancelActiveHitl(hitl.home)
    return Promise.resolve({
      code: null,
      stdout: hitl.stdout,
      stderr: 'cancelled',
      cancelled: true,
      run_dir: extractRunDir(hitl.stdout),
    })
  }

  return new Promise(resolve => {
    let lineBuf = hitl.buffer || ''
    const onAbort = (): void => {
      cancelActiveHitl(hitl.home)
      resolve({
        code: null,
        stdout: hitl.stdout,
        stderr: 'cancelled by host stop',
        cancelled: true,
        run_dir: extractRunDir(hitl.stdout),
      })
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    const origResolve = hitl.resolve
    hitl.resolve = r => {
      signal?.removeEventListener('abort', onAbort)
      origResolve(r)
      resolve(r)
    }

    // Re-parse any already-buffered stdout for a subsequent need_human / done.
    const check = (chunk: string): void => {
      lineBuf += chunk
      let nl: number
      while ((nl = lineBuf.indexOf('\n')) >= 0) {
        const line = lineBuf.slice(0, nl).replace(/\r$/, '').trim()
        lineBuf = lineBuf.slice(nl + 1)
        const need = parseNeedHuman(line)
        if (need && options.earlyHitl !== false) {
          signal?.removeEventListener('abort', onAbort)
          resolve({
            code: null,
            stdout: hitl.stdout,
            stderr: hitl.stderr,
            earlyHitl: true,
            needHuman: need,
            run_dir: extractRunDir(hitl.stdout),
          })
          return
        }
      }
    }
    // Attach incremental parser alongside existing accumulators.
    hitl.child.stdout?.on('data', (c: Buffer) => check(c.toString('utf8')))
    if (hitl.child.exitCode != null) {
      signal?.removeEventListener('abort', onAbort)
      const r: SpawnResult = {
        code: hitl.child.exitCode,
        stdout: hitl.stdout,
        stderr: hitl.stderr,
        run_dir: extractRunDir(hitl.stdout),
      }
      if (!hitl.settled) {
        hitl.settled = true
        if (hitl.timer) clearTimeout(hitl.timer)
        activeHitl = null
        origResolve(r)
      }
      resolve(r)
    }
  })
}

export function hasActiveHitl(): boolean {
  return activeHitl != null && activeHitl.child.exitCode == null
}

/**
 * Write a UTF-8 recipe file under the OS temp dir and return its path.
 */
export function writeTempRecipe(recipe: string): string {
  const dir = join(tmpdir(), 'webclaw-dsh')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `recipe-${randomUUID()}.webclaw`)
  writeFileSync(path, recipe, { encoding: 'utf8' })
  return path
}

/**
 * Parse the last JSONL `done` event from run stdout.
 *
 * lite emits `ok`/`fail` as **step counts** (u32), e.g.
 * `{"type":"done","ok":2,"fail":0,"run_dir":"..."}` — not a boolean.
 */
export function parseDoneEvent(stdout: string): {
  readonly ok: boolean
  readonly okCount?: number
  readonly fail?: number
  readonly error?: string
  readonly run_dir?: string
} | undefined {
  const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!line.includes('"done"')) continue
    try {
      const row = JSON.parse(line) as {
        type?: string
        ok?: boolean | number
        fail?: number
        error?: string
        run_dir?: string
      }
      if (row.type === 'done') {
        const fail =
          typeof row.fail === 'number' && Number.isFinite(row.fail) ? row.fail : 0
        const okCount =
          typeof row.ok === 'number' && Number.isFinite(row.ok)
            ? row.ok
            : undefined
        const ok =
          row.ok === true
            ? true
            : row.ok === false
              ? false
              : fail === 0 && !row.error
        return {
          ok,
          okCount,
          fail,
          error: row.error,
          run_dir: row.run_dir,
        }
      }
    } catch {
      continue
    }
  }
  return undefined
}
