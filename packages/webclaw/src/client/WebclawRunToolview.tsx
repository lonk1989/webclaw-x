/**
 * In-chat tool card for webclaw_run: while pending, poll live step logs.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { LivePreviewImage } from './LivePreviewImage.js'
import { requestOpenLive } from './live-open.ts'

const CANDIDATE_PORTS = [19229, 19230, 19231, 19232, 19233]

type Phase = 'preparing' | 'start' | 'result'

type Block = {
  content?: readonly { type: string; text?: string }[]
  meta?: unknown
  isError?: boolean
  argsRaw?: string
  call?: { name: string; argsRaw: string } | null
  error?: { name: string; code: string; reason?: string }
}

export type WebclawRunToolviewProps = PropsLocale<'webclawRunTool'> & {
  toolName: string
  phase: Phase
  block: Block
}

async function findBase(): Promise<string | null> {
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

function textFromResult(block: Block): string {
  const parts = (block.content ?? [])
    .filter(b => b.type === 'text' && b.text)
    .map(b => b.text!.trim())
    .filter(Boolean)
  return parts.join('\n').trim()
}

function summarizeResult(text: string, t: WebclawRunToolviewProps['t']): string {
  if (/NEED_HUMAN|needHuman|需要验证码|需要人工/i.test(text)) return t('needHuman')
  if (/cancelled|已取消|RUN_CANCELLED/i.test(text)) return t('cancelled')
  if (/webclaw_run:\s*ok\b|^ok\b/im.test(text) || /\bok\b.*run_dir/i.test(text)) {
    return t('done')
  }
  if (/webclaw_run:\s*failed|failed|error:/i.test(text)) return t('failed')
  return t('done')
}

/**
 * Pending: live log poll. Result: keep a short log panel from result text.
 */
export function WebclawRunToolview({
  phase,
  block,
  t,
}: WebclawRunToolviewProps): ReactNode {
  const [lines, setLines] = useState<string[]>([])
  const [baseOk, setBaseOk] = useState(true)
  const [imgUrl, setImgUrl] = useState('')
  /** Host clears live markers before param confirm; a runDir means lite has started. */
  const [started, setStarted] = useState(false)
  const scroller = useRef<HTMLDivElement | null>(null)
  const openedRunDir = useRef('')
  const pending = phase === 'preparing' || phase === 'start'

  useEffect(() => {
    if (!pending) return
    let cancelled = false
    let base: string | null = null
    const tick = async () => {
      if (!base) base = await findBase()
      if (cancelled) return
      if (!base) {
        setBaseOk(false)
        return
      }
      setBaseOk(true)
      try {
        const [logRes, focusRes] = await Promise.all([
          fetch(`${base}/api/live/log`),
          fetch(`${base}/api/live/focus`),
        ])
        const j = (await logRes.json()) as {
          ok?: boolean
          lines?: string[]
          runDir?: string
        }
        const focusJson = (await focusRes.json()) as {
          ok?: boolean
          focus?: { runDir?: string }
        }
        if (!cancelled && j.ok && Array.isArray(j.lines)) {
          setLines(j.lines.slice(-60))
        }
        const runDir =
          j.runDir?.trim() || focusJson.focus?.runDir?.trim() || ''
        if (!cancelled) setStarted(runDir !== '')
        // Session-scoped tool card is the most reliable moment to open the right rail.
        if (runDir && runDir !== openedRunDir.current) {
          openedRunDir.current = runDir
          requestOpenLive(runDir)
        }
        // Follow live-preview/timeline only (real page shots — never captcha crop).
        if (!runDir) {
          if (!cancelled) setImgUrl('')
          return
        }
        const metaRes = await fetch(
          `${base}/api/live/meta?runDir=${encodeURIComponent(runDir)}&t=${Date.now()}`,
          { cache: 'no-store' },
        ).catch(() => null)
        let nextUrl = ''
        if (metaRes?.ok) {
          try {
            const metaJson = (await metaRes.json()) as {
              ok?: boolean
              hasPng?: boolean
              latestId?: number | null
              meta?: { updatedAt?: string }
            }
            if (metaJson.ok && metaJson.hasPng) {
              const latest =
                typeof metaJson.latestId === 'number' ? metaJson.latestId : null
              const bust = metaJson.meta?.updatedAt || latest || Date.now()
              const q = new URLSearchParams({ runDir, t: String(bust) })
              if (latest != null) q.set('frame', String(latest))
              nextUrl = `${base}/api/live/png?${q.toString()}`
            }
          } catch {
            nextUrl = ''
          }
        }
        if (!cancelled) setImgUrl(nextUrl)
      } catch {
        base = null
        if (!cancelled) {
          setBaseOk(false)
          setImgUrl('')
        }
      }
    }
    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 700)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [pending])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines])

  useEffect(() => {
    if (pending) return
    const text = textFromResult(block)
    if (!text) return
    const extracted = text
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('{') && !/^recipePath:|^run_dir:|^error:$/i.test(s))
      .slice(-40)
    if (extracted.length > 0) setLines(extracted)
  }, [pending, block])

  // Pending before lite starts = Host is still confirming params: no preview yet,
  // so the param form is the only thing asking for attention.
  const awaitingStart = pending && !started

  const header = awaitingStart
    ? t('waitingStart')
    : pending
    ? t('pending')
    : block.isError
      ? t('failed')
      : summarizeResult(textFromResult(block), t)

  return (
    <div
      data-webclaw-run-toolview=""
      style={{
        marginTop: 6,
        borderRadius: 8,
        border: '1px solid color-mix(in srgb, currentColor 14%, transparent)',
        overflow: 'hidden',
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          fontWeight: 600,
          background: 'color-mix(in srgb, currentColor 6%, transparent)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>{header}</span>
        {pending && !awaitingStart ? (
          <span style={{ opacity: 0.55, fontWeight: 400 }}>
            {baseOk ? 'live' : t('offline')}
          </span>
        ) : null}
      </div>
      {awaitingStart ? null : (<>
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          background: 'color-mix(in srgb, currentColor 4%, transparent)',
        }}
      >
        <LivePreviewImage
          src={imgUrl}
          alt="webclaw live preview"
          label={t('placeholder')}
          maxHeight={160}
        />
      </div>
      <div
        ref={scroller}
        style={{
          maxHeight: 220,
          overflow: 'auto',
          padding: '8px 10px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          opacity: 0.92,
        }}
      >
        {!baseOk && pending ? (
          <span style={{ opacity: 0.65 }}>{t('offline')}</span>
        ) : lines.length === 0 ? (
          <span style={{ opacity: 0.65 }}>{t('empty')}</span>
        ) : (
          lines.map((line, i) => (
            <div key={`${i}-${line.slice(0, 24)}`}>{line}</div>
          ))
        )}
      </div>
      </>)}
    </div>
  )
}
