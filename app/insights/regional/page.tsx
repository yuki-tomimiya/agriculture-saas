import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { getRegionalContextForUser } from '@/lib/insights/regional-context'

function formatDiff(pct: number | null): string {
  if (pct === null) return '—'
  if (pct > 0) return `+${pct}%`
  return `${pct}%`
}

export default async function InsightsRegionalPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const regional = await getRegionalContextForUser(user.id)

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <p className="gdd-breadcrumb">
              <Link href="/insights" className="gdd-breadcrumb-link">
                振り返りと計画
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              <span>この地域の気象</span>
            </p>
            <h1 className="farms-title">
              {regional.primary
                ? `${regional.primary.month}月の降水量（10年平均比）`
                : 'この地域の気象（地域）'}
            </h1>
            <p className="farms-subtitle">
              今月の降水量を、同じ期間の10年平均（推計）と昨年同時期と比べます
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

        <section className="card insights-section">
          {regional.primary ? (
            <div className="insights-regional">
              <p className="insights-regional-text">{regional.primary.interpretation}</p>
              <div className="insights-regional-stats">
                <div>
                  <span className="insights-regional-stat-label">10年平均比</span>
                  <span className="insights-regional-stat-value">
                    {regional.primary.normalRatioPct !== null
                      ? `${regional.primary.normalRatioPct}%`
                      : formatDiff(regional.primary.diffPct)}
                  </span>
                </div>
                <div>
                  <span className="insights-regional-stat-label">
                    今月（推計・〜{regional.primary.dayOfMonth}日）
                  </span>
                  <span className="insights-regional-stat-value">
                    {regional.primary.thisYearMm !== null
                      ? `${regional.primary.thisYearMm} mm`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="insights-regional-stat-label">10年平均（推計）</span>
                  <span className="insights-regional-stat-value">
                    {regional.primary.normalMm !== null ? `${regional.primary.normalMm} mm` : '—'}
                  </span>
                </div>
                <div>
                  <span className="insights-regional-stat-label">昨年同時期</span>
                  <span className="insights-regional-stat-value">
                    {regional.primary.lastYearMm !== null
                      ? `${regional.primary.lastYearMm} mm`
                      : '—'}
                  </span>
                </div>
              </div>
              {regional.primary.farmName && (
                <p className="insights-regional-meta">
                  基準：{regional.primary.farmName}の座標。10年平均（推計）＝この地点の過去10年を平均した再解析です
                </p>
              )}
              <p className="insights-regional-link">
                <Link href="/weather" className="text-green-700 hover:underline">
                  気象ナビで詳細を見る →
                </Link>
                {'　'}
                <Link href="/dashboard/ai-proposal" className="text-green-700 hover:underline">
                  今日の提案へ →
                </Link>
              </p>
            </div>
          ) : (
            <div className="insights-regional">
              <p className="insights-regional-text">
                {regional.needsCoordinates
                  ? '農場に緯度・経度を登録すると、この地域の降水量（今月 vs 昨年）を表示できます。'
                  : '農場を登録し、緯度・経度を設定すると地域の気象解釈が表示されます。'}
              </p>
              <p className="insights-regional-link">
                <Link href="/farms" className="text-green-700 hover:underline">
                  農場管理へ →
                </Link>
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
