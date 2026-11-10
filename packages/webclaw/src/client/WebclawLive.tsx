/**
 * Right-sidebar body: scrubbable live-preview timeline (Doubao-style).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { LivePreviewImage } from './LivePreviewImage.js'

/** Minimal tab info used by the live body (framework injects the rest). */
export type WebclawLiveProps = PropsLocale<'webclawLive'> & {
  useTabInfo: () => {
    tab: {
      navigation?: {
        params?: unknown
        revision?: number
      }
    }
  }
}

interface LiveFrame {
  id: number
  file: string
  step?: number
  keyword?: string
  at?: string
}

const CANDIDATE_PORTS = [19229, 19230, 19231, 19232, 19233]

async function findBase(): Promise<string | null> {
  for (const port of CANDIDATE_PORTS) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 500)
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

function runDirFromNav(params: unknown): string {
  if (!params || typeof params !== 'object') return ''
  const p = params as { runDir?: unknown }
  return typeof p.runDir === 'string' ? p.runDir.trim() : ''
}

function frameLabel(frame: LiveFrame | undefined, fallback: string): string {
  const kw = frame?.keyword?.trim()
  if (kw) return kw
  if (typeof frame?.step === 'number' && frame.step > 0) return `#${frame.step}`
  return fallback
}

function pngUrl(base: string, runDir: string, frameId: number | null, bust: string): string {
  const q = new URLSearchParams({ runDir })
  if (frameId != null) q.set('frame', String(frameId))
  q.set('t', bust)
  return `${base}/api/live/png?${q.toString()}`
}

/**
 * Live execution preview with scrubber + Live mode.
 */
export function WebclawLive({ t, useTabInfo }: WebclawLiveProps): ReactNode {
  const { tab } = useTabInfo()
  const navRunDir = runDirFromNav(tab.navigation?.params)
  const [base, setBase] = useState<string | null>(null)
  const [runDir, setRunDir] = useState(navRunDir)
  const [frames, setFrames] = useState<LiveFrame[]>([])
  const [index, setIndex] = useState(0)
  const [live, setLive] = useState(true)
  const [imgUrl, setImgUrl] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const liveRef = useRef(true)
  const draggingRef = useRef(false)
  const indexRef = useRef(0)
  const trackRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    liveRef.current = live
  }, [live])
  useEffect(() => {
    draggingRef.current = dragging
  }, [dragging])
  useEffect(() => {
    indexRef.current = index
  }, [index])

  const hardResetPreview = useCallback((nextRunDir: string) => {
    setRunDir(nextRunDir)
    setFrames([])
    setImgUrl('')
    setIndex(0)
    indexRef.current = 0
    setError('')
    setLive(true)
    liveRef.current = true
    setDragging(false)
    draggingRef.current = false
  }, [])

  useEffect(() => {
    if (!navRunDir) return
    if (navRunDir === runDir) return
    hardResetPreview(navRunDir)
  }, [navRunDir, tab.navigation?.revision, runDir, hardResetPreview])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const found = await findBase()
      if (!cancelled) setBase(found)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const goLive = useCallback(() => {
    setLive(true)
    liveRef.current = true
    setFrames(prev => {
      if (prev.length) setIndex(prev.length - 1)
      return prev
    })
  }, [])

  const applyScrubIndex = useCallback(
    (next: number, list: LiveFrame[], activeRunDir?: string, activeBase?: string) => {
      if (!list.length) return
      const clamped = Math.max(0, Math.min(list.length - 1, next))
      indexRef.current = clamped
      setIndex(clamped)
      const atEnd = clamped >= list.length - 1
      setLive(atEnd)
      liveRef.current = atEnd
      const b = activeBase || base
      const rd = activeRunDir || runDir
      const frame = list[clamped]
      if (b && rd && frame) {
        setImgUrl(pngUrl(b, rd, frame.id, String(frame.at || frame.id)))
      }
    },
    [base, runDir],
  )

  const indexFromClientX = useCallback((clientX: number, listLen: number) => {
    const el = trackRef.current
    if (!el || listLen <= 1) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * (listLen - 1))
  }, [])

  const onTrackPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!frames.length) return
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
      draggingRef.current = true
      applyScrubIndex(indexFromClientX(e.clientX, frames.length), frames)
    },
    [applyScrubIndex, frames, indexFromClientX],
  )

  const onTrackPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !frames.length) return
      applyScrubIndex(indexFromClientX(e.clientX, frames.length), frames)
    },
    [applyScrubIndex, frames, indexFromClientX],
  )

  const onTrackPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    setDragging(false)
    draggingRef.current = false
  }, [])

  useEffect(() => {
    if (!base) return
    let cancelled = false
    const tick = async () => {
      try {
        const focusRes = await fetch(`${base}/api/live/focus`, {
          cache: 'no-store',
        })
        const focusJson = (await focusRes.json()) as {
          ok?: boolean
          focus?: { runDir?: string; seq?: number }
        }
        const focused = focusJson.focus?.runDir?.trim() || ''
        // Focus is source of truth while a run is active — don't stick on a stale tab param.
        const active = (focused || runDir).trim()
        if (!active) {
          if (!cancelled) {
            setError('')
            setFrames([])
            setImgUrl('')
          }
          return
        }
        // Force-clear old captcha/timeline the moment focus switches — don't wait for meta.
        if (focused && focused !== runDir) {
          if (!cancelled) hardResetPreview(focused)
        }

        const metaRes = await fetch(
          `${base}/api/live/meta?runDir=${encodeURIComponent(active)}&t=${Date.now()}`,
          { cache: 'no-store' },
        )
        const metaJson = (await metaRes.json()) as {
          ok?: boolean
          meta?: { keyword?: string; updatedAt?: string; frameId?: number } | null
          frames?: LiveFrame[]
          latestId?: number | null
          hasPng?: boolean
          error?: string
        }
        if (cancelled) return
        if (!metaJson.ok) {
          setError(metaJson.error || t('waiting'))
          return
        }
        setError('')

        const nextFrames = Array.isArray(metaJson.frames) ? metaJson.frames : []
        setFrames(nextFrames)

        const followLive = liveRef.current && !draggingRef.current
        let viewIndex = 0
        if (nextFrames.length) {
          if (followLive) {
            viewIndex = nextFrames.length - 1
            indexRef.current = viewIndex
            setIndex(viewIndex)
            setLive(true)
          } else {
            viewIndex = Math.max(
              0,
              Math.min(indexRef.current, nextFrames.length - 1),
            )
            indexRef.current = viewIndex
            setIndex(viewIndex)
          }
        }

        if (!metaJson.hasPng && !nextFrames.length) {
          setImgUrl('')
          return
        }

        const frame = nextFrames[viewIndex]
        // Live mode: pin to latest frame id so each heartbeat gets a distinct URL
        // (live-preview.png alone can look "stuck" under aggressive image caching).
        const frameId = frame?.id ?? null
        const bust = String(
          followLive
            ? metaJson.meta?.updatedAt ||
                metaJson.latestId ||
                frame?.at ||
                Date.now()
            : frame?.at || frame?.id || Date.now(),
        )
        setImgUrl(pngUrl(base, active, frameId, bust))
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('offline'))
        }
      }
    }
    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [base, runDir, t, hardResetPreview])

  if (!base) {
    return (
      <div style={{ padding: 16, fontSize: 13, opacity: 0.8 }}>{t('offline')}</div>
    )
  }

  if (!runDir && !frames.length && !imgUrl) {
    return (
      <div style={{ padding: 16, fontSize: 13, opacity: 0.8 }}>{t('waiting')}</div>
    )
  }

  const current = frames[Math.min(index, Math.max(0, frames.length - 1))]
  const label = live ? t('live') : frameLabel(current, t('scrubHint'))
  const maxIdx = Math.max(0, frames.length - 1)
  const progress = maxIdx === 0 ? 1 : index / maxIdx

  const chipStyle: CSSProperties = {
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 999,
    transition: 'background 160ms ease, color 160ms ease, box-shadow 160ms ease',
    background: live
      ? 'color-mix(in srgb, #16a34a 22%, transparent)'
      : 'color-mix(in srgb, currentColor 8%, transparent)',
    color: live ? '#15803d' : 'inherit',
    boxShadow: live ? '0 0 0 1px color-mix(in srgb, #16a34a 45%, transparent)' : 'none',
    opacity: live ? 1 : 0.75,
  }

  return (
    <div
      data-webclaw-live=""
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: 12,
        gap: 10,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minHeight: 28,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: live ? 0.55 : 0.9,
          }}
          title={live ? t('live') : frameLabel(current, '')}
        >
          {live ? t('scrubHint') : label}
        </div>
        <button type="button" style={chipStyle} onClick={goLive} aria-pressed={live}>
          {t('live')}
        </button>
      </div>

      {error ? (
        <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 160,
          borderRadius: 10,
          overflow: 'hidden',
          background: 'color-mix(in srgb, currentColor 6%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
        }}
      >
        <LivePreviewImage src={imgUrl} label={t('placeholder')} />
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={maxIdx}
        aria-valuenow={index}
        aria-label={t('scrubHint')}
        tabIndex={0}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerUp}
        onKeyDown={e => {
          if (!frames.length) return
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            applyScrubIndex(index - 1, frames)
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            applyScrubIndex(index + 1, frames)
          } else if (e.key === 'Home') {
            e.preventDefault()
            applyScrubIndex(0, frames)
          } else if (e.key === 'End') {
            e.preventDefault()
            applyScrubIndex(maxIdx, frames)
          }
        }}
        style={{
          position: 'relative',
          height: 28,
          display: 'flex',
          alignItems: 'center',
          cursor: frames.length ? 'ew-resize' : 'default',
          touchAction: 'none',
          userSelect: 'none',
          paddingTop: 2,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 999,
            background: 'color-mix(in srgb, currentColor 14%, transparent)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${Math.max(2, progress * 100)}%`,
            height: 4,
            borderRadius: 999,
            background: live
              ? 'color-mix(in srgb, #16a34a 70%, currentColor)'
              : 'color-mix(in srgb, currentColor 45%, transparent)',
            transition: dragging ? 'none' : 'width 120ms ease',
          }}
        />
        {frames.length > 1
          ? frames.map((f, i) => (
              <div
                key={f.id}
                title={frameLabel(f, '')}
                style={{
                  position: 'absolute',
                  left: `${(i / maxIdx) * 100}%`,
                  width: 2,
                  height: i === 0 || i === maxIdx ? 8 : 5,
                  marginLeft: -1,
                  borderRadius: 1,
                  background:
                    i <= index
                      ? 'color-mix(in srgb, currentColor 55%, transparent)'
                      : 'color-mix(in srgb, currentColor 18%, transparent)',
                  pointerEvents: 'none',
                }}
              />
            ))
          : null}
        <div
          style={{
            position: 'absolute',
            left: `${progress * 100}%`,
            width: 14,
            height: 14,
            marginLeft: -7,
            borderRadius: '50%',
            background: live ? '#16a34a' : 'currentColor',
            boxShadow: live
              ? '0 0 0 4px color-mix(in srgb, #16a34a 28%, transparent)'
              : '0 0 0 3px color-mix(in srgb, currentColor 12%, transparent)',
            transition: dragging ? 'none' : 'left 120ms ease, background 160ms ease',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}
