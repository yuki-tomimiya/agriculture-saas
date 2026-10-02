import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { getCropSeasonComparisons } from '@/lib/insights/crop-season-compare'
import { getSeasonalWorkHints, listBenchmarkDisplayNames } from '@/lib/benchmarks/crops'

export default async function InsightsGeneralPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const comparisons = await getCropSeasonComparisons(user.id)
  const month = new Date().getMonth() + 1
  const seasonalHints = getSeasonalWorkHints(
    comparisons.map((c) => c.cropName),
    month
  )

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <p className="gdd-breadcrumb">
              <Link href="/insights" className="gdd-breadcrumb-link">
                分析・振り返り
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              <span>栽培暦の目安</span>
            </p>
            <h1 className="farms-title">栽培暦の目安（一般）</h1>
            <p className="farms-subtitle">
              品目ごとの教科書的な目安・今月の栽培暦ヒントを確認します
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/dashboard/ai-proposal" className="btn btn-outline farms-add-button">
              今日の提案
            </Link>
            <Link href="/insights" className="btn btn-outline farms-add-button">
              入口へ戻る
            </Link>
          </div>
        </div>

        {seasonalHints.length > 0 ? (
          <section className="card insights-section">
            <h2 className="insights-section-title">{month}月の栽培暦の目安（一般）</h2>
            <ul className="insights-hint-list">
              {seasonalHints.map((h) => (
                <li key={h.cropLabel}>
                  <strong>{h.cropLabel}</strong>：{h.hint}
                </li>
              ))}
            </ul>
            <p className="insights-regional-meta" style={{ marginTop: '0.75rem' }}>
              一般目安の登録品目：{listBenchmarkDisplayNames().join('、')}
            </p>
          </section>
        ) : (
          <section className="card insights-section">
            <h2 className="insights-section-title">栽培暦の目安（一般）</h2>
            <p className="insights-regional-text">
              今月のヒントに該当する作付けがありません。目安がある品目は次のとおりです：
              {listBenchmarkDisplayNames().join('、')}
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
