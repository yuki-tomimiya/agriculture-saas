'use client'

/**
 * 開発時「missing required error components」を減らすため、
 * next/link や globals のクラスに依存しない最小構成にしている。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '28rem',
        margin: '0 auto',
      }}
    >
      <p style={{ color: '#b91c1c', fontWeight: 600 }}>エラーが発生しました</p>
      <p style={{ fontSize: '0.875rem', color: '#4b5563', marginTop: '0.75rem' }}>
        {error.message || 'しばらくしてから再度お試しください。'}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '0.5rem 1rem',
            background: '#16a34a',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          再試行
        </button>
        <a
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.5rem 1rem',
            color: '#16a34a',
            fontWeight: 600,
            border: '2px solid #16a34a',
            borderRadius: '0.5rem',
            textDecoration: 'none',
          }}
        >
          ダッシュボードへ
        </a>
      </div>
    </div>
  )
}
