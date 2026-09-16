import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="not-found-page">
      <h1 className="not-found-title">ページが見つかりません</h1>
      <p className="not-found-desc">URL が間違っているか、ページが移動した可能性があります。</p>
      <Link href="/" className="not-found-link">
        ホームへ戻る
      </Link>
    </div>
  )
}
