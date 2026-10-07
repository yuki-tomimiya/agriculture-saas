import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { getCropSeasonComparisons } from '@/lib/insights/crop-season-compare'
import { getRegionalContextForUser } from '@/lib/insights/regional-context'
import { formatDateShort } from '@/lib/utils'

function formatYen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`
}

function formatDiff(pct: number | null): string {
  if (pct === null) return '—'
  if (pct > 0) return `+${pct}%`
  return `${pct}%`
}

export default async function InsightsComparePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const [comparisons, regional] = await Promise.all([
    getCropSeasonComparisons(user.id),
    getRegionalContextForUser(user.id),
  ])

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
              <span>作付け比較</span>
            </p>
            <h1 className="farms-title">作付け比較（あなた）</h1>
            <p className="farms-subtitle">
              前回の同じ作付けとの収量・売上を並べて振り返ります
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

        <section className="insights-section-wrap">
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
            <CompareSections comparisons={comparisons} regional={regional} />
          )}
        </section>
      </main>
    </div>
  )
}

function CompareSections({
  comparisons,
  regional,
}: {
  comparisons: Awaited<ReturnType<typeof getCropSeasonComparisons>>
  regional: Awaited<ReturnType<typeof getRegionalContextForUser>>
}) {
  const compared = comparisons.filter((row) => row.previousCropId)
  const unmatched = comparisons.filter((row) => !row.previousCropId)
  return (
    <>
      {compared.length > 0 && (
        <div className="insights-grid">
          {compared.map((row) => (
            <CompareCard key={row.currentCropId} row={row} regional={regional} />
          ))}
        </div>
      )}
      {unmatched.length > 0 && (
        <section className="card insights-section" style={{ marginTop: compared.length > 0 ? '1.5rem' : 0 }}>
          <h2 className="gdd-section-title">前回作付けがまだない作物</h2>
          <p className="farms-subtitle">
            {unmatched.length}件は、同名・同品種・同農場の前回がないため、比較の文は出していません。
          </p>
          <ul className="gdd-crop-list-other-list">
            {unmatched.map((row) => (
              <li key={row.currentCropId}>
                <Link href={`/crops/${row.currentCropId}`} className="gdd-crop-list-other-link">
                  {row.currentLabel}
                </Link>
                {row.farmName ? `（${row.farmName}）` : ''}
                {row.plantingDate ? ` ・ 植付 ${formatDateShort(row.plantingDate)}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function CompareCard({
  row,
  regional,
}: {
  row: Awaited<ReturnType<typeof getCropSeasonComparisons>>[number]
  regional: Awaited<ReturnType<typeof getRegionalContextForUser>>
}) {
  const farmRegional = (row.farmId && regional.byFarmId[row.farmId]) || regional.primary
  return (
    <article className="card insights-card insights-card--compared">
      <div className="insights-card-header">
        <h3 className="insights-card-title">
          <Link href={`/crops/${row.currentCropId}`} className="farms-card-title-link">
            {row.currentLabel}
          </Link>
        </h3>
        {row.farmName && <p className="insights-card-meta">農場：{row.farmName}</p>}
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
            {row.harvestRecorded ? `${row.harvestQty} ${row.harvestUnit}` : '記録なし'}
          </span>
          <span>
            {row.previousHarvestRecorded === null
              ? '—'
              : row.previousHarvestRecorded
                ? `${row.previousHarvestQty} ${row.harvestUnit}`
                : '記録なし'}
          </span>
          <span>{formatDiff(row.harvestDiffPct)}</span>
        </div>
        <div className="insights-compare-row">
          <span>売上</span>
          <span>{row.salesRecorded ? formatYen(row.salesAmount) : '記録なし'}</span>
          <span>
            {row.previousSalesRecorded === null
              ? '—'
              : row.previousSalesRecorded
                ? formatYen(row.previousSalesAmount ?? 0)
                : '記録なし'}
          </span>
          <span>{formatDiff(row.salesDiffPct)}</span>
        </div>
      </div>

      {row.previousLabel && (
        <p className="insights-previous-label">
          前回：
          {row.previousCropId ? (
            <Link href={`/crops/${row.previousCropId}`} className="text-green-700 hover:underline">
              {row.previousLabel}
            </Link>
          ) : (
            row.previousLabel
          )}
          {row.previousPlantingDate && (
            <span className="text-gray-500"> （植付 {formatDateShort(row.previousPlantingDate)}）</span>
          )}
        </p>
      )}

      <div className="insights-layers">
        <p>
          <span className="insights-layer-tag">あなた</span>
          {row.summaryLine}
        </p>
        {farmRegional && (
          <p>
            <span className="insights-layer-tag">地域</span>
            {farmRegional.shortLine}
          </p>
        )}
      </div>

      <p className="insights-card-links">
        <Link href={`/crops/${row.currentCropId}`} className="text-green-700 hover:underline text-sm">
          作物を見る →
        </Link>
        {row.plantingDate && (
          <Link href={`/gdd/${row.currentCropId}`} className="text-green-700 hover:underline text-sm">
            {row.currentStatus === 'growing' ? '生育ナビで見る →' : '積算温度など（過去）→'}
          </Link>
        )}
        {row.previousCropId && row.previousPlantingDate && (
          <Link href={`/gdd/${row.previousCropId}`} className="text-green-700 hover:underline text-sm">
            前回の生育データ →
          </Link>
        )}
        <Link href="/dashboard/ai-proposal" className="text-green-700 hover:underline text-sm">
          今日の提案へ →
        </Link>
      </p>
    </article>
  )
}
