/**
 * Loopback-only HTTP UI for site accounts.
 *
 * Bound to 127.0.0.1 — passwords never leave the machine or enter the LLM.
 * DSH Client (when isLoopback) and the desktop browser launcher both use this.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { isAbsolute, join, normalize, resolve, sep } from 'node:path'
import type { LiteEnv } from './spawn.js'
import { listAccounts, saveAccountFromForm } from './accounts-vault.js'
import {
  writeLiveFocus,
  type LiveFocusPayload,
  type LiveLogPayload,
} from './live-focus.js'

/** Default port (near CDP 19222); falls back to ephemeral if busy. */
export const ACCOUNTS_UI_DEFAULT_PORT = 19229

export interface AccountsUiHandle {
  readonly port: number
  readonly url: string
  close: () => void
  /** Forget in-memory focus (call with clearLiveFocus on Host dispose). */
  clearFocus: () => void
}

/** In-memory mirror of the latest live-focus (Client polls this). */
let latestFocus: LiveFocusPayload | null = null

function readFocusFromDisk(home: string): LiveFocusPayload | null {
  try {
    const raw = readFileSync(join(home, 'control', 'live-focus.json'), 'utf8')
    const parsed = JSON.parse(raw) as LiveFocusPayload
    if (!parsed?.runDir || typeof parsed.seq !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

/** Prefer the newer of memory vs disk (Host may write the file before POST lands). */
function syncLatestFocus(home: string): LiveFocusPayload | null {
  const disk = readFocusFromDisk(home)
  // Disk cleared (Host dispose / desktop quit) → drop stale memory too.
  if (!disk) {
    latestFocus = null
    return null
  }
  if (!latestFocus || disk.seq >= latestFocus.seq) {
    latestFocus = disk
  }
  return latestFocus
}

function underHome(home: string, candidate: string): string | null {
  const trimmed = candidate.trim()
  if (!trimmed || !isAbsolute(trimmed)) return null
  let homeReal: string
  let candReal: string
  try {
    homeReal = realpathSync(home)
    candReal = existsSync(trimmed) ? realpathSync(trimmed) : resolve(normalize(trimmed))
  } catch {
    return null
  }
  const prefix = homeReal.endsWith(sep) ? homeReal : homeReal + sep
  if (candReal !== homeReal && !candReal.startsWith(prefix)) return null
  return candReal
}

function readLiveMeta(runDir: string): Record<string, unknown> | null {
  const metaPath = join(runDir, 'live-preview.json')
  if (!existsSync(metaPath)) return null
  try {
    return JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

export interface LiveTimelineFrame {
  id: number
  file: string
  step?: number
  keyword?: string
  at?: string
}

function readLiveTimeline(runDir: string): {
  frames: LiveTimelineFrame[]
  latestId: number | null
} {
  const timelinePath = join(runDir, 'live-timeline.json')
  if (!existsSync(timelinePath)) return { frames: [], latestId: null }
  try {
    const raw = JSON.parse(readFileSync(timelinePath, 'utf8')) as {
      frames?: unknown
      latestId?: unknown
    }
    const frames: LiveTimelineFrame[] = []
    if (Array.isArray(raw.frames)) {
      for (const item of raw.frames) {
        if (!item || typeof item !== 'object') continue
        const f = item as Record<string, unknown>
        const id = typeof f.id === 'number' ? f.id : Number(f.id)
        const file = typeof f.file === 'string' ? f.file : ''
        if (!Number.isFinite(id) || id <= 0 || !file) continue
        const keyword = typeof f.keyword === 'string' ? f.keyword : undefined
        // Drop legacy captcha-crop frames so scrubber stays on real page shots.
        if (keyword === '验证码') continue
        frames.push({
          id,
          file,
          step: typeof f.step === 'number' ? f.step : undefined,
          keyword,
          at: typeof f.at === 'string' ? f.at : undefined,
        })
      }
    }
    frames.sort((a, b) => a.id - b.id)
    const latestId = frames.length ? frames[frames.length - 1]!.id : null
    return { frames, latestId }
  } catch {
    return { frames: [], latestId: null }
  }
}

function resolveLivePngPath(
  home: string,
  safe: string | null,
  frameId: number | null,
): string | null {
  if (safe && frameId != null && frameId > 0) {
    const timeline = readLiveTimeline(safe)
    const hit = timeline.frames.find(f => f.id === frameId)
    if (hit) {
      const framed = join(safe, 'live-frames', hit.file)
      if (existsSync(framed)) return framed
    }
  }
  // Live preview = real page screenshots only. Never fall back to captcha crops
  // (human/captcha.png or WEBCLAW_HOME/last-captcha.png) — those belong on /api/live/captcha.
  const candidates: string[] = []
  if (safe) {
    candidates.push(join(safe, 'live-preview.png'))
    const framesDir = join(safe, 'live-frames')
    if (existsSync(framesDir)) {
      try {
        const newestFrame = readdirSync(framesDir)
          .filter(n => n.toLowerCase().endsWith('.png'))
          .map(n => join(framesDir, n))
          .map(p => ({ p, t: statSync(p).mtimeMs }))
          .sort((a, b) => b.t - a.t)[0]
        if (newestFrame) candidates.push(newestFrame.p)
      } catch {
        /* ignore */
      }
    }
    const shotDir = join(safe, 'screenshots')
    if (existsSync(shotDir)) {
      try {
        const newest = readdirSync(shotDir)
          .filter(n => n.toLowerCase().endsWith('.png'))
          .map(n => join(shotDir, n))
          .map(p => ({ p, t: statSync(p).mtimeMs }))
          .sort((a, b) => b.t - a.t)[0]
        if (newest) candidates.push(newest.p)
      } catch {
        /* ignore */
      }
    }
  }
  return candidates.find(p => existsSync(p)) || null
}

function isLoopbackOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  try {
    const u = new URL(origin)
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost'
  } catch {
    // Electron / custom desktop schemes often use opaque origins.
    return /^(app|file|vscode-webview|dsh|fengxing|cordis):/i.test(origin)
  }
}

/** Live preview APIs are loopback-only; allow any Origin so desktop shells can poll. */
function setLiveCors(res: ServerResponse, origin: string | undefined): void {
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(raw)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > 64_000) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function pageHtml(port: number): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>webclaw 网站账号</title>
<style>
  :root { color-scheme: light dark; font-family: "Segoe UI", system-ui, sans-serif; }
  body { margin: 0; padding: 24px; max-width: 720px; }
  h1 { font-size: 1.25rem; margin: 0 0 8px; }
  .hint { opacity: .75; font-size: 13px; margin-bottom: 20px; line-height: 1.5; }
  .card { border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
  .card h2 { font-size: 1rem; margin: 0 0 10px; }
  label { display: block; font-size: 12px; opacity: .7; margin: 8px 0 4px; }
  input { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent); background: transparent; color: inherit; }
  .row { display: flex; gap: 10px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
  button { padding: 8px 14px; border-radius: 6px; border: 0; cursor: pointer;
    background: #2563eb; color: #fff; font-weight: 600; }
  button:disabled { opacity: .5; cursor: default; }
  .badge { font-size: 12px; padding: 2px 8px; border-radius: 999px;
    background: color-mix(in srgb, currentColor 10%, transparent); }
  .badge.ok { background: color-mix(in srgb, #16a34a 25%, transparent); }
  .msg { font-size: 13px; margin-top: 8px; min-height: 1.2em; }
  .err { color: #dc2626; }
  .okmsg { color: #16a34a; }
</style>
</head>
<body>
  <h1>网站账号（本机保险箱）</h1>
  <p class="hint">
    仅监听 127.0.0.1:${port}。密码写入本机 webclaw vault（Windows DPAPI），
    <strong>不会</strong>进入 DSH 对话或模型。留空密码表示保持原密码不变。
  </p>
  <div id="list">加载中…</div>
<script>
async function load() {
  const res = await fetch('/api/accounts');
  const data = await res.json();
  const root = document.getElementById('list');
  if (!data.ok) { root.textContent = data.error || '加载失败'; return; }
  root.innerHTML = '';
  for (const item of data.items || []) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = \`
      <h2>\${escapeHtml(item.name || item.id)}
        <span class="badge \${item.has_password ? 'ok' : ''}">\${item.has_password ? '已设密码' : '未设密码'}</span>
      </h2>
      <label>登录地址</label>
      <input data-f="url" value="\${escapeAttr(item.url || '')}"/>
      <label>账号</label>
      <input data-f="username" value="\${escapeAttr(item.username || '')}" autocomplete="username"/>
      <label>密码（留空=不修改）</label>
      <input data-f="password" type="password" value="" autocomplete="new-password"/>
      <div class="row">
        <button type="button" data-save>保存</button>
        <span class="msg" data-msg></span>
      </div>\`;
    card.querySelector('[data-save]').onclick = async () => {
      const msg = card.querySelector('[data-msg]');
      const btn = card.querySelector('[data-save]');
      btn.disabled = true; msg.textContent = '保存中…'; msg.className = 'msg';
      const body = {
        id: item.id,
        name: item.name,
        url: card.querySelector('[data-f=url]').value,
        username: card.querySelector('[data-f=username]').value,
        password: card.querySelector('[data-f=password]').value,
      };
      try {
        const r = await fetch('/api/accounts/' + encodeURIComponent(item.id), {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (j.ok) {
          msg.textContent = '已保存到本机';
          msg.className = 'msg okmsg';
          card.querySelector('[data-f=password]').value = '';
          const badge = card.querySelector('.badge');
          if (j.item?.has_password) { badge.textContent = '已设密码'; badge.classList.add('ok'); }
        } else {
          msg.textContent = j.error || '保存失败';
          msg.className = 'msg err';
        }
      } catch (e) {
        msg.textContent = String(e?.message || e);
        msg.className = 'msg err';
      } finally { btn.disabled = false; }
    };
    root.appendChild(card);
  }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/\`/g, '&#96;'); }
load();
</script>
</body>
</html>`
}

function writeLaunchers(opts: {
  home: string
  binaryPath: string
  url: string
}): void {
  const binDir = join(opts.home, 'bin')
  mkdirSync(binDir, { recursive: true })
  if (process.platform === 'win32') {
    const lite = opts.binaryPath.replace(/\//g, '\\')
    // Absolute-path wrappers so users need not put webclaw-lite on PATH.
    const liteCmd = `@echo off\r\n"${lite}" %*\r\n`
    writeFileSync(join(binDir, 'webclaw-lite.cmd'), liteCmd, 'utf8')
    const accountsCmd = `@echo off\r\necho Opening webclaw accounts UI...\r\nstart "" "${opts.url}"\r\n`
    writeFileSync(join(binDir, 'webclaw-accounts.cmd'), accountsCmd, 'utf8')
  } else {
    const lite = opts.binaryPath
    const liteSh = `#!/bin/sh\nexec "${lite}" "$@"\n`
    const accountsSh =
      `#!/bin/sh\necho "Opening webclaw accounts UI..."\n` +
      `open "${opts.url}" 2>/dev/null || xdg-open "${opts.url}" 2>/dev/null || echo "${opts.url}"\n`
    const litePath = join(binDir, 'webclaw-lite.sh')
    const accountsPath = join(binDir, 'webclaw-accounts')
    writeFileSync(litePath, liteSh, 'utf8')
    writeFileSync(accountsPath, accountsSh, 'utf8')
    try {
      chmodSync(litePath, 0o755)
      chmodSync(accountsPath, 0o755)
    } catch {
      /* best-effort */
    }
  }
  writeFileSync(
    join(opts.home, 'accounts-ui.json'),
    JSON.stringify({ url: opts.url, port: Number(new URL(opts.url).port), bind: '127.0.0.1' }, null, 2),
    'utf8',
  )
}

/**
 * Start loopback accounts UI. Returns null if disabled / failed.
 */
export async function startAccountsUiServer(options: {
  enabled: boolean
  preferredPort: number
  /** Client reveals the live tab on new runs only when true. */
  liveAutoOpen?: boolean
  getEnv: () => Promise<LiteEnv>
  home: string
  binaryPath: string
  log: {
    info: (msg: string, ...args: unknown[]) => void
    warn: (msg: string, ...args: unknown[]) => void
  }
}): Promise<AccountsUiHandle | null> {
  if (!options.enabled) return null

  const envFor = options.getEnv

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const origin = req.headers.origin
    const host = req.headers.host || `127.0.0.1`
    const url = new URL(req.url || '/', `http://${host}`)
    const isLiveApi = url.pathname.startsWith('/api/live') || url.pathname === '/api/health'

    if (origin && !isLoopbackOrigin(origin) && !isLiveApi) {
      sendJson(res, 403, { ok: false, error: 'forbidden origin' })
      return
    }
    if (isLiveApi) {
      setLiveCors(res, origin)
    } else if (origin && isLoopbackOrigin(origin)) {
      setLiveCors(res, origin)
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        sendJson(res, 200, { ok: true, service: 'webclaw-accounts-ui' })
        return
      }
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        const html = pageHtml(Number(url.port) || options.preferredPort)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(html)
        return
      }
      if (req.method === 'GET' && url.pathname === '/api/accounts') {
        const listed = await listAccounts(await envFor())
        sendJson(res, listed.ok ? 200 : 500, listed)
        return
      }
      const putMatch = /^\/api\/accounts\/([^/]+)$/.exec(url.pathname)
      if (req.method === 'PUT' && putMatch) {
        const id = decodeURIComponent(putMatch[1]!)
        const raw = await readBody(req)
        let body: Record<string, unknown>
        try {
          body = JSON.parse(raw) as Record<string, unknown>
        } catch {
          sendJson(res, 400, { ok: false, error: 'invalid JSON' })
          return
        }
        const saved = await saveAccountFromForm(await envFor(), {
          id,
          name: typeof body.name === 'string' ? body.name : undefined,
          url: String(body.url ?? ''),
          username: String(body.username ?? ''),
          password: String(body.password ?? ''),
        })
        sendJson(res, saved.ok ? 200 : 400, saved)
        return
      }

      // --- live preview for webclaw-live sidebar ---
      if (req.method === 'GET' && url.pathname === '/api/live/focus') {
        // Always reconcile with disk: publishLiveFocus writes the file first;
        // if the follow-up POST fails, a stale in-memory focus would hide new runs
        // until Host restart (exactly the "sidebar only after restart" bug).
        sendJson(res, 200, {
          ok: true,
          focus: syncLatestFocus(options.home),
          autoOpen: options.liveAutoOpen === true,
        })
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/live/focus') {
        const raw = await readBody(req)
        let body: Record<string, unknown>
        try {
          body = JSON.parse(raw) as Record<string, unknown>
        } catch {
          sendJson(res, 400, { ok: false, error: 'invalid JSON' })
          return
        }
        const runDir = typeof body.runDir === 'string' ? body.runDir : ''
        const safe = underHome(options.home, runDir)
        if (!safe) {
          sendJson(res, 400, { ok: false, error: 'runDir must be under WEBCLAW_HOME' })
          return
        }
        latestFocus = writeLiveFocus(options.home, safe)
        sendJson(res, 200, { ok: true, focus: latestFocus })
        return
      }
      if (req.method === 'GET' && url.pathname === '/api/live/meta') {
        const runDir = url.searchParams.get('runDir') || latestFocus?.runDir || ''
        const safe = underHome(options.home, runDir)
        if (!safe) {
          sendJson(res, 400, { ok: false, error: 'runDir missing or outside WEBCLAW_HOME' })
          return
        }
        const meta = readLiveMeta(safe)
        const timeline = readLiveTimeline(safe)
        const hasLive = existsSync(join(safe, 'live-preview.png'))
        const hasShot = (() => {
          const shotDir = join(safe, 'screenshots')
          if (!existsSync(shotDir)) return false
          try {
            return readdirSync(shotDir).some(n => n.toLowerCase().endsWith('.png'))
          } catch {
            return false
          }
        })()
        // Captcha crops are not live-preview frames.
        sendJson(res, 200, {
          ok: true,
          runDir: safe,
          meta,
          frames: timeline.frames,
          latestId: timeline.latestId,
          hasPng: hasLive || hasShot || timeline.frames.length > 0,
        })
        return
      }
      if (req.method === 'GET' && url.pathname === '/api/live/png') {
        const runDir = url.searchParams.get('runDir') || latestFocus?.runDir || ''
        const safe = runDir ? underHome(options.home, runDir) : null
        const frameRaw = url.searchParams.get('frame')
        const frameId =
          frameRaw && /^\d+$/.test(frameRaw) ? Number.parseInt(frameRaw, 10) : null
        const pngPath = resolveLivePngPath(options.home, safe, frameId)
        if (!pngPath) {
          sendJson(res, 404, { ok: false, error: 'no preview png' })
          return
        }
        const buf = readFileSync(pngPath)
        res.writeHead(200, {
          'Content-Type': 'image/png',
          // Always no-store: sidebar polls during long waits/captcha; max-age hid new frames.
          'Cache-Control': 'no-store',
          'Content-Length': buf.length,
        })
        res.end(buf)
        return
      }
      if (req.method === 'GET' && url.pathname === '/api/live/captcha') {
        const runDir = url.searchParams.get('runDir') || latestFocus?.runDir || ''
        const safe = runDir ? underHome(options.home, runDir) : null
        const candidates = [
          safe ? join(safe, 'human', 'captcha.png') : '',
          join(options.home, 'last-captcha.png'),
          safe ? join(safe, 'live-preview.png') : '',
        ].filter(Boolean)
        const pngPath = candidates.find(p => existsSync(p))
        if (!pngPath) {
          sendJson(res, 404, { ok: false, error: 'captcha image not found' })
          return
        }
        const buf = readFileSync(pngPath)
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
          'Content-Length': buf.length,
        })
        res.end(buf)
        return
      }
      if (req.method === 'GET' && url.pathname === '/api/live/log') {
        let live: LiveLogPayload | null = null
        try {
          live = JSON.parse(
            readFileSync(join(options.home, 'control', 'live-log.json'), 'utf8'),
          ) as LiveLogPayload
        } catch {
          live = null
        }
        const runDir =
          url.searchParams.get('runDir') || live?.runDir || latestFocus?.runDir || ''
        const safe = runDir ? underHome(options.home, runDir) : null
        let fileTail: string[] = []
        if (safe) {
          const logPath = join(safe, 'executions', 'run-log.txt')
          if (existsSync(logPath)) {
            try {
              const raw = readFileSync(logPath, 'utf8')
              fileTail = raw
                .split(/\r?\n/)
                .map(s => s.trimEnd())
                .filter(Boolean)
                .slice(-80)
            } catch {
              fileTail = []
            }
          }
        }
        const mirrored = Array.isArray(live?.lines) ? live.lines : []
        // Prefer Host-mirrored JSONL user lines when present; else file tail.
        const lines = mirrored.length > 0 ? mirrored.slice(-80) : fileTail
        sendJson(res, 200, {
          ok: true,
          runDir: safe || live?.runDir || '',
          lines,
          updatedAt: live?.updatedAt || new Date().toISOString(),
          seq: typeof live?.seq === 'number' ? live.seq : 0,
        })
        return
      }

      sendJson(res, 404, { ok: false, error: 'not found' })
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const listen = (port: number): Promise<AccountsUiHandle> =>
    new Promise((resolve, reject) => {
      const server: Server = createServer((req, res) => {
        void handler(req, res)
      })
      server.once('error', reject)
      server.listen(port, '127.0.0.1', () => {
        const addr = server.address()
        const p =
          typeof addr === 'object' && addr && 'port' in addr ? addr.port : port
        const url = `http://127.0.0.1:${p}/`
        try {
          writeLaunchers({
            home: options.home,
            binaryPath: options.binaryPath,
            url,
          })
        } catch (error) {
          options.log.warn(
            'webclaw: write accounts launchers failed: %s',
            error instanceof Error ? error.message : error,
          )
        }
        options.log.info('webclaw: accounts UI on %s (loopback only)', url)
        resolve({
          port: p,
          url,
          close: () => {
            server.close()
          },
          clearFocus: () => {
            latestFocus = null
          },
        })
      })
    })

  try {
    return await listen(options.preferredPort)
  } catch {
    try {
      return await listen(0)
    } catch (error) {
      options.log.warn(
        'webclaw: accounts UI failed to start: %s',
        error instanceof Error ? error.message : error,
      )
      return null
    }
  }
}

/** Probe loopback health (Client). */
export async function probeAccountsUi(
  ports: number[] = [ACCOUNTS_UI_DEFAULT_PORT],
): Promise<string | null> {
  for (const port of ports) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 400)
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (!res.ok) continue
      const j = (await res.json()) as { ok?: boolean; service?: string }
      if (j.ok && j.service === 'webclaw-accounts-ui') {
        return `http://127.0.0.1:${port}/`
      }
    } catch {
      /* try next */
    }
  }
  return null
}
