/**
 * Notify DSH Client to open the webclaw-live sidebar tab for a run,
 * and mirror JSONL log lines for the in-chat toolview while run is pending.
 */
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
/** Keep in sync with accounts-ui-server ACCOUNTS_UI_DEFAULT_PORT (avoid circular import). */
const LIVE_UI_DEFAULT_PORT = 19229;
const LIVE_LOG_CAP = 200;
let focusSeq = 0;
let logSeq = 0;
const liveLines = [];
let liveRunDir = '';
/** Persist focus marker under WEBCLAW_HOME/control. */
export function writeLiveFocus(home, runDir) {
    const payload = {
        runDir: runDir.trim(),
        updatedAt: new Date().toISOString(),
        seq: ++focusSeq,
    };
    const dir = join(home, 'control');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'live-focus.json'), `${JSON.stringify(payload, null, 2)}\n`, {
        encoding: 'utf8',
    });
    if (runDir.trim() && runDir.trim() !== liveRunDir) {
        liveRunDir = runDir.trim();
    }
    return payload;
}
/** Best-effort POST to loopback accounts/live UI so Client can openTab immediately. */
export async function notifyLiveFocusHttp(runDir) {
    const ports = [
        LIVE_UI_DEFAULT_PORT,
        LIVE_UI_DEFAULT_PORT + 1,
        LIVE_UI_DEFAULT_PORT + 2,
        LIVE_UI_DEFAULT_PORT + 3,
        LIVE_UI_DEFAULT_PORT + 4,
    ];
    for (const port of ports) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 400);
            const res = await fetch(`http://127.0.0.1:${port}/api/live/focus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ runDir }),
                signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (res.ok)
                return;
        }
        catch {
            /* try next */
        }
    }
}
/** Write focus file and ping loopback UI. */
export async function publishLiveFocus(home, runDir) {
    const payload = writeLiveFocus(home, runDir);
    await notifyLiveFocusHttp(runDir);
    return payload;
}
/** Drop leftover focus/log markers so a cold Client start does not reopen the rail. */
export function clearLiveFocus(home) {
    liveRunDir = '';
    liveLines.length = 0;
    for (const name of ['live-focus.json', 'live-log.json']) {
        try {
            unlinkSync(join(home, 'control', name));
        }
        catch {
            /* missing is fine */
        }
    }
}
/** Reset live log buffer at the start of a new run. */
export function resetLiveLog(home, hint) {
    liveLines.length = 0;
    liveRunDir = '';
    logSeq = 0;
    if (hint?.trim())
        liveLines.push(hint.trim());
    writeLiveLogFile(home);
}
/** Status / chrome chatter — keep out of the in-chat live log (steps only). */
function isLiveLogNoise(message) {
    const m = message.trim();
    if (!m)
        return true;
    if (m.startsWith('── 步骤') || m.startsWith('步骤 '))
        return false;
    if (m.startsWith('登录成功') || m.startsWith('验证码'))
        return false;
    return (m.startsWith('run_dir=') ||
        m.startsWith('════') ||
        m.startsWith('继续任务：') ||
        m.startsWith('新任务：') ||
        m.startsWith('CDP 已连接') ||
        m.startsWith('已启用下载') ||
        m.startsWith('已启用浏览器内存') ||
        m.startsWith('下载截获') ||
        m.startsWith('浏览器内存') ||
        m.startsWith('伙伴浏览器') ||
        m.startsWith('产物已与对话绑定') ||
        m.startsWith('任务浏览器：') ||
        m.startsWith('live-preview') ||
        m.includes('正在启动 webclaw') ||
        m === '开始执行…');
}
/** Extract a user-facing line from one JSONL event (or return plain text). */
export function formatLiveLogLine(raw) {
    const line = raw.trim();
    if (!line)
        return undefined;
    if (!line.startsWith('{')) {
        return isLiveLogNoise(line) ? undefined : line.slice(0, 500);
    }
    try {
        const row = JSON.parse(line);
        if (row.type === 'step_start') {
            const idx = typeof row.index === 'number' ? row.index : 0;
            const total = typeof row.total === 'number' ? row.total : 0;
            const kw = [row.keyword, row.args].filter(Boolean).join(' ').trim();
            return `── 步骤 ${idx}/${total} ── ${kw || ''}`.trim();
        }
        if (row.type === 'step_ok') {
            const idx = typeof row.index === 'number' ? row.index : 0;
            const total = typeof row.total === 'number' ? row.total : 0;
            const detail = typeof row.detail === 'string' ? row.detail.trim() : '';
            return detail
                ? `步骤 ${idx}/${total} 成功 · ${detail}`
                : `步骤 ${idx}/${total} 成功`;
        }
        if (row.type === 'step_fail') {
            const idx = typeof row.index === 'number' ? row.index : 0;
            const total = typeof row.total === 'number' ? row.total : 0;
            const err = typeof row.error === 'string'
                ? row.error.trim()
                : '';
            return err
                ? `步骤 ${idx}/${total} 失败 · ${err}`
                : `步骤 ${idx}/${total} 失败`;
        }
        if (row.type === 'log' && typeof row.message === 'string' && row.message.trim()) {
            const msg = row.message.trim();
            return isLiveLogNoise(msg) ? undefined : msg;
        }
        // Skip run_start / done banners — steps only.
        if (row.type === 'run_start' || row.type === 'done')
            return undefined;
        if (row.type === 'need_human') {
            return row.hint?.trim() || `需要人工确认（${row.kind || 'captcha'}）`;
        }
        if (row.type === 'error' && row.error)
            return String(row.error).slice(0, 300);
        return undefined;
    }
    catch {
        return isLiveLogNoise(line) ? undefined : line.slice(0, 500);
    }
}
/** Append one user-facing log line and persist for Client polling. */
export function appendLiveLog(home, message, runDir) {
    const text = message.trim();
    if (text) {
        liveLines.push(text);
        while (liveLines.length > LIVE_LOG_CAP)
            liveLines.shift();
    }
    if (runDir?.trim())
        liveRunDir = runDir.trim();
    return writeLiveLogFile(home);
}
function writeLiveLogFile(home) {
    const payload = {
        runDir: liveRunDir,
        lines: [...liveLines],
        updatedAt: new Date().toISOString(),
        seq: ++logSeq,
    };
    const dir = join(home, 'control');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'live-log.json'), `${JSON.stringify(payload)}\n`, {
        encoding: 'utf8',
    });
    return payload;
}
/** Parse a stdout chunk into complete lines and append live log messages. */
export function ingestLiveLogChunk(home, chunk, state, runDir) {
    state.buf += chunk;
    let nl;
    while ((nl = state.buf.indexOf('\n')) >= 0) {
        const line = state.buf.slice(0, nl).replace(/\r$/, '');
        state.buf = state.buf.slice(nl + 1);
        const msg = formatLiveLogLine(line);
        if (msg)
            appendLiveLog(home, msg, runDir);
    }
}
