'use client'

/**
 * ルート layout 自体が失敗したとき用（独自の html/body が必須）
 * 開発時の「missing required error components」緩和にも寄与する場合があります。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center',
          background: '#f9fafb',
          color: '#111827',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', color: '#b91c1c' }}>エラーが発生しました</h1>
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6b7280', maxWidth: '28rem', marginInline: 'auto' }}>
          {error.message || 'しばらくしてから再度お試しください。'}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            padding: '0.5rem 1.25rem',
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
      </body>
    </html>
  )
}
