/**
 * Promote webclaw run deliverables into the DSH workspace `outputs/` folder
 * and best-effort mark them in Fengxing's library-artifact-index.json.
 *
 * Deliverables: downloads/ documents/ files/ (+ recipe screenshots/).
 * Not promoted: executions/, live-preview*, live-frames/, human/, README, temps.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, extname, join, relative } from 'node:path'

const DELIVERABLE_DIRS = ['downloads', 'documents', 'files', 'screenshots'] as const

const ALLOWED_EXT = new Set([
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.xlsm',
  '.pptx',
  '.ppt',
  '.pdf',
  '.csv',
  '.zip',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.md',
  '.txt',
  '.html',
  '.htm',
])

const DENY_NAMES = new Set([
  'readme.md',
  'live-preview.png',
  'live-preview.json',
  'live-timeline.json',
  'thumbs.db',
  'desktop.ini',
  '.ds_store',
])

const MAX_FILES = 80

export interface PromotedOutput {
  readonly name: string
  readonly path: string
  readonly rel: string
}

export interface PromoteOutputsResult {
  readonly workspaceDir?: string
  readonly outputs: readonly PromotedOutput[]
  readonly marked: number
  readonly skipped: number
}

type ArtifactMarkSource = 'tool' | 'present' | 'text' | 'upload' | 'run'

interface ArtifactIndexEntry {
  readonly sessionId: string
  readonly markedAt: string
  readonly path?: string
  readonly mtimeMs?: number
  readonly name?: string
  readonly source: ArtifactMarkSource
}

interface ArtifactIndexDocument {
  readonly version: 1
  readonly entries: Record<string, ArtifactIndexEntry>
}

function normalizeArtifactPath(value: string): string {
  return value.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

function productRoot(): string {
  const appData = process.env.APPDATA?.trim()
  if (appData) return join(appData, 'Fengxing')
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Fengxing')
  }
  return join(homedir(), '.local', 'share', 'Fengxing')
}

/** Resolve Fengxing dsh-home (same rules as corp-auth library.ts). */
export function resolveFengxingDshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  if (fromEnv) return fromEnv
  const desktopJson = join(productRoot(), 'desktop.json')
  try {
    const raw = readFileSync(desktopJson, 'utf8')
    const parsed = JSON.parse(raw) as { dshHome?: unknown }
    if (typeof parsed.dshHome === 'string' && parsed.dshHome.trim() !== '') {
      return parsed.dshHome.trim()
    }
  } catch {
    /* ignore */
  }
  return join(productRoot(), 'dsh-home')
}

function isDeliverableFile(name: string): boolean {
  const base = name.trim()
  if (!base || base.startsWith('.')) return false
  const lower = base.toLowerCase()
  if (DENY_NAMES.has(lower)) return false
  if (lower.endsWith('.crdownload') || lower.endsWith('.tmp') || lower.endsWith('.partial')) {
    return false
  }
  if (lower.startsWith('live-')) return false
  const ext = extname(lower)
  return ALLOWED_EXT.has(ext)
}

function listDeliverableSources(runDir: string): string[] {
  const out: string[] = []
  for (const sub of DELIVERABLE_DIRS) {
    const dir = join(runDir, sub)
    if (!existsSync(dir)) continue
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (!isDeliverableFile(name)) continue
      const full = join(dir, name)
      try {
        const st = statSync(full)
        if (!st.isFile() || st.size <= 0) continue
      } catch {
        continue
      }
      out.push(full)
      if (out.length >= MAX_FILES) return out
    }
  }
  return out
}

function stampFolder(runDir: string): string {
  const base = basename(runDir).replace(/[^\w\u4e00-\u9fff.-]+/g, '_').slice(0, 48)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `webclaw-${ts}${base ? `-${base}` : ''}`
}

function uniqueDest(dir: string, name: string): string {
  const dest = join(dir, name)
  if (!existsSync(dest)) return dest
  const ext = extname(name)
  const stem = ext ? name.slice(0, -ext.length) : name
  for (let i = 2; i < 1000; i++) {
    const cand = join(dir, `${stem}-${i}${ext}`)
    if (!existsSync(cand)) return cand
  }
  return join(dir, `${stem}-${Date.now()}${ext}`)
}

function markProductPaths(
  dshHome: string,
  paths: readonly string[],
  sessionId: string,
): number {
  const sid = sessionId.trim()
  if (!sid || paths.length === 0) return 0
  const indexPath = join(dshHome, 'library-artifact-index.json')
  let doc: ArtifactIndexDocument = { version: 1, entries: {} }
  try {
    if (existsSync(indexPath)) {
      const parsed = JSON.parse(readFileSync(indexPath, 'utf8')) as Partial<ArtifactIndexDocument>
      if (parsed.version === 1 && parsed.entries && typeof parsed.entries === 'object') {
        doc = { version: 1, entries: { ...parsed.entries } }
      }
    }
  } catch {
    doc = { version: 1, entries: {} }
  }

  let marked = 0
  const markedAt = new Date().toISOString()
  for (const absolutePath of paths) {
    const path = absolutePath.trim()
    if (!path) continue
    const key = normalizeArtifactPath(path)
    let mtimeMs: number | undefined
    try {
      mtimeMs = statSync(path).mtimeMs
    } catch {
      /* ignore */
    }
    doc.entries[key] = {
      sessionId: sid,
      markedAt,
      path,
      source: 'tool',
      name: basename(path),
      ...(typeof mtimeMs === 'number' ? { mtimeMs } : {}),
    }
    marked += 1
  }

  mkdirSync(dshHome, { recursive: true })
  const tmp = `${indexPath}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  renameSync(tmp, indexPath)
  return marked
}

/**
 * Copy important run artifacts into `{cwd}/outputs/webclaw-…/` and mark for 资料库.
 * No-op when cwd/runDir missing or no deliverables. Never throws to callers.
 */
export function promoteRunDeliverables(opts: {
  readonly runDir?: string
  readonly cwd?: string
  readonly sessionId?: string
}): PromoteOutputsResult {
  const runDir = opts.runDir?.trim()
  const cwd = opts.cwd?.trim()
  if (!runDir || !cwd || !existsSync(runDir)) {
    return { outputs: [], marked: 0, skipped: 0 }
  }

  try {
    const sources = listDeliverableSources(runDir)
    if (sources.length === 0) {
      return { outputs: [], marked: 0, skipped: 0 }
    }

    const outRoot = join(cwd, 'outputs')
    const workspaceDir = join(outRoot, stampFolder(runDir))
    mkdirSync(workspaceDir, { recursive: true })

    const outputs: PromotedOutput[] = []
    let skipped = 0
    for (const src of sources) {
      try {
        const name = basename(src)
        const dest = uniqueDest(workspaceDir, name)
        copyFileSync(src, dest)
        const rel = relative(cwd, dest).replace(/\\/g, '/')
        outputs.push({ name: basename(dest), path: dest, rel })
      } catch {
        skipped += 1
      }
    }

    let marked = 0
    const sessionId = opts.sessionId?.trim() || ''
    if (sessionId && outputs.length > 0) {
      try {
        marked = markProductPaths(
          resolveFengxingDshHome(),
          outputs.map((o) => o.path),
          sessionId,
        )
      } catch {
        marked = 0
      }
    }

    return { workspaceDir, outputs, marked, skipped }
  } catch {
    return { outputs: [], marked: 0, skipped: 0 }
  }
}
