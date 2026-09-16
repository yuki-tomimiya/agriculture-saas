import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { getCropSeasonComparisons } from '@/lib/insights/crop-season-compare'
import { getRegionalContextForUser } from '@/lib/insights/regional-context'
import { getSeasonalWorkHints, listBenchmarkDisplayNames } from '@/lib/benchmarks/crops'
import { formatDateShort } from '@/lib/utils'

function formatYen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`
}

function formatDiff(pct: number | null): string {
  if (pct === null) return '—'
  if (pct > 0) return `+${pct}%`
  return `${pct}%`
}

export default async function InsightsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const [comparisons, regional] = await Promise.all([
    getCropSeasonComparisons(user.id),
    getRegionalContextForUser(user.id),
  ])
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
            <h1 className="farms-title">分析・振り返り</h1>
            <p className="farms-subtitle">
              作付け単位の比較・一般目安・地域の気象を確認できます。過去の生育グラフは生育ナビの「過去の作付け」へ
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/dashboard/ai-proposal" className="btn btn-primary farms-add-button">
              今日の提案へ
            </Link>
            <Link href="/gdd/past" className="btn btn-outline farms-add-button">
              過去の生育データ
            </Link>
          </div>
        </div>

        <section className="card insights-intro">
          <p className="insights-intro-text">
            <span className="insights-layer-tag">あなた</span>
            前回の同じ作付けとの比較　
            <span className="insights-layer-tag">一般</span>
            品目ごとの教科書的な目安　
            <span className="insights-layer-tag">地域</span>
            農場周辺の降水量（今月 vs 昨年同時期）
          </p>
        </section>

        <section className="card insights-section">
          <h2 className="insights-section-title">
            {regional.primary
              ? `${regional.primary.month}月の降水量（地域）`
              : 'この地域の気象（地域）'}
          </h2>
          {regional.primary ? (
            <div className="insights-regional">
              <p className="insights-regional-text">{regional.primary.interpretation}</p>
              <div className="insights-regional-stats">
                <div>
                  <span className="insights-regional-stat-label">今月（〜{regional.primary.dayOfMonth}日）</span>
                  <span className="insights-regional-stat-value">
                    {regional.primary.thisYearMm !== null
                      ? `${regional.primary.thisYearMm} mm`
                      : '—'}
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
                <div>
                  <span className="insights-regional-stat-label">差</span>
                  <span className="insights-regional-stat-value">
                    {formatDiff(regional.primary.diffPct)}
                  </span>
                </div>
              </div>
              {regional.primary.farmName && (
                <p className="insights-regional-meta">
                  基準：{regional.primary.farmName}の座標（Open-Meteo）
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

        {seasonalHints.length > 0 && (
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
        )}
        {seasonalHints.length === 0 && (
          <section className="card insights-section">
            <h2 className="insights-section-title">栽培暦の目安（一般）</h2>
            <p className="insights-regional-text">
              今月のヒントに該当する作付けがありません。目安がある品目は次のとおりです：
              {listBenchmarkDisplayNames().join('、')}
            </p>
          </section>
        )}

        <section className="insights-section-wrap">
          <h2 className="insights-section-title insights-section-title--page">
            作付け比較（あなた）
          </h2>
          {comparisons.length === 0 ? (
            <div className="card farms-empty-card">
              <div className="farms-empty-icon">📊</div>
              <h3 className="farms-empty-title">比較できる作付けがありません</h3>
              <p className="farms-empty-text">
                作物を登録し、収穫や販売を記録すると、前回作付けとの比較が表示されます
              </p>
              <Link href="/crops/new" className="btn btn-primary farms-add-button">
                作物を登録
              </Link>
            </div>
          ) : (
            <div className="insights-grid">
              {comparisons.map((row) => {
                const farmRegional =
                  (row.farmId && regional.byFarmId[row.farmId]) || regional.primary
                return (
                  <article
                    key={row.currentCropId}
                    className={`card insights-card${row.previousCropId ? ' insights-card--compared' : ''}`}
                  >
                    <div className="insights-card-header">
                      <h3 className="insights-card-title">
                        <Link href={`/crops/${row.currentCropId}`} className="farms-card-title-link">
                          {row.currentLabel}
                        </Link>
                      </h3>
                      {row.farmName && (
                        <p className="insights-card-meta">農場：{row.farmName}</p>
                      )}
                    </div>

                    <div className="insights-compare-table">
                      <div className="insights-compare-row insights-compare-row--head">
                        <span />
                        <span>今回</span>
                        <span>前回作付け</span>
                        <span>差</span>
                      </div>
                      <div className="insights-compare-row">
                        <span>収量</span>
                        <span>
                          {row.harvestQty} {row.harvestUnit}
                        </span>
                        <span>
                          {row.previousHarvestQty !== null
                            ? `${row.previousHarvestQty} ${row.harvestUnit}`
                            : '—'}
                        </span>
                        <span>{formatDiff(row.harvestDiffPct)}</span>
                      </div>
                      <div className="insights-compare-row">
                        <span>売上</span>
                        <span>{formatYen(row.salesAmount)}</span>
                        <span>
                          {row.previousSalesAmount !== null
                            ? formatYen(row.previousSalesAmount)
                            : '—'}
                        </span>
                        <span>{formatDiff(row.salesDiffPct)}</span>
                      </div>
                    </div>

                    {row.previousLabel ? (
                      <p className="insights-previous-label">
                        前回：
                        {row.previousCropId ? (
                          <Link
                            href={`/crops/${row.previousCropId}`}
                            className="text-green-700 hover:underline"
                          >
                            {row.previousLabel}
                          </Link>
                        ) : (
                          row.previousLabel
                        )}
                        {row.previousPlantingDate && (
                          <span className="text-gray-500">
                            {' '}
                            （植付 {formatDateShort(row.previousPlantingDate)}）
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="insights-previous-label text-gray-500">
                        同名・同品種・同農場の前回作付けがありません
                      </p>
                    )}

                    <div className="insights-layers">
                      <p>
                        <span className="insights-layer-tag">あなた</span>
                        {row.summaryLine}
                      </p>
                      {row.benchmark ? (
                        <p>
                          <span className="insights-layer-tag">一般</span>
                          {row.benchmark.yieldHint}
                          {row.benchmark.generalTips[0]
                            ? ` ／ ${row.benchmark.generalTips[0]}`
                            : ''}
                        </p>
                      ) : (
                        <p>
                          <span className="insights-layer-tag">一般</span>
                          この品目の一般目安は準備中です（さつまいも・トマト・レタス等から順次追加）
                        </p>
                      )}
                      <p>
                        <span className="insights-layer-tag">地域</span>
                        {farmRegional
                          ? farmRegional.shortLine
                          : '農場に緯度・経度を登録すると、この地域の降水量が表示されます。'}
                      </p>
                    </div>

                    <p className="insights-card-links">
                      <Link
                        href={`/crops/${row.currentCropId}`}
                        className="text-green-700 hover:underline text-sm"
                      >
                        作物を見る →
                      </Link>
                      {row.plantingDate && (
                        <Link
                          href={`/gdd?cropId=${row.currentCropId}`}
                          className="text-green-700 hover:underline text-sm"
                        >
                          {row.currentStatus === 'growing'
                            ? '生育ナビで見る →'
                            : '積算温度など（過去）→'}
                        </Link>
                      )}
                      {row.previousCropId && row.previousPlantingDate && (
                        <Link
                          href={`/gdd?cropId=${row.previousCropId}`}
                          className="text-green-700 hover:underline text-sm"
                        >
                          前回の生育データ →
                        </Link>
                      )}
                      <Link
                        href="/dashboard/ai-proposal"
                        className="text-green-700 hover:underline text-sm"
                      >
                        今日の提案へ →
                      </Link>
                    </p>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
