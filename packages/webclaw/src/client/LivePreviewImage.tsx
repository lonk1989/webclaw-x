/**
 * Live PNG with a calm placeholder instead of the browser's broken-image icon.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

type Props = {
  src: string
  alt?: string
  label: string
  maxHeight?: number | string
  style?: CSSProperties
}

const shellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 120,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
}

const placeholderStyle: CSSProperties = {
  ...shellStyle,
  flexDirection: 'column',
  gap: 10,
  padding: 16,
  borderRadius: 8,
  border: '1px dashed color-mix(in srgb, currentColor 22%, transparent)',
  background:
    'repeating-linear-gradient(135deg, color-mix(in srgb, currentColor 5%, transparent) 0 8px, transparent 8px 16px)',
  color: 'inherit',
  opacity: 0.78,
}

function Placeholder({ label, maxHeight }: { label: string; maxHeight?: number | string }): ReactNode {
  return (
    <div style={{ ...placeholderStyle, maxHeight, minHeight: typeof maxHeight === 'number' ? Math.min(120, maxHeight) : 120 }}>
      <svg width="36" height="28" viewBox="0 0 36 28" aria-hidden="true" style={{ opacity: 0.55 }}>
        <rect x="1.5" y="1.5" width="33" height="25" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="11" cy="10" r="2.5" fill="currentColor" opacity="0.45" />
        <path
          d="M4 22 L13 12 L18 16 L24 9 L32 22 Z"
          fill="currentColor"
          opacity="0.28"
        />
      </svg>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </div>
  )
}

export function LivePreviewImage({ src, alt = '', label, maxHeight, style }: Props): ReactNode {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>(src ? 'loading' : 'error')

  useEffect(() => {
    setStatus(src ? 'loading' : 'error')
  }, [src])

  if (!src || status === 'error') {
    return <Placeholder label={label} maxHeight={maxHeight} />
  }

  return (
    <div style={{ ...shellStyle, position: 'relative', maxHeight, ...style }}>
      {status === 'loading' ? (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Placeholder label={label} maxHeight={maxHeight} />
        </div>
      ) : null}
      <img
        key={src}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('error')}
        style={{
          maxWidth: '100%',
          maxHeight: maxHeight ?? '100%',
          objectFit: 'contain',
          display: status === 'ok' ? 'block' : 'none',
        }}
      />
    </div>
  )
}
