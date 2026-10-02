import { getCurrentUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { getCropSeasonRetrospective } from '@/lib/insights/crop-season-retrospective'
import { formatDateShort } from '@/lib/utils'

function formatYen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`
}

function formatDiff(pct: number | null): string {
  if (pct === null) return '—'
  if (pct > 0) return `+${pct}%`
  return `${pct}%`
}

function statusLabel(status: string): string {
  if (status === 'growing') return '栽培中'
  if (status === 'harvested') return '収穫済み'
  return '完了'
}

export default async function CropRetrospectivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ from?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { id } = await params
  const sp = searchParams ? await searchParams : undefined
  const fromStatus = sp?.from === 'status'

  const data = await getCropSeasonRetrospective(user.id, id)
  if (!data) notFound()

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <p className="gdd-breadcrumb">
              <Link href="/crops" className="gdd-breadcrumb-link">
                作物管理
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              <Link href={`/crops/${id}`} className="gdd-breadcrumb-link">
                {data.cropName}
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              <span>振り返り</span>
            </p>
            <h1 className="farms-title">今シーズンの振り返り</h1>
            <p className="farms-subtitle">{data.label}</p>
          </div>
          <div className="insights-header-actions">
            <Link href={`/crops/${id}`} className="btn btn-outline farms-add-button">
              作物詳細
            </Link>
            <Link href="/insights/compare" className="btn btn-outline farms-add-button">
              作付け比較
            </Link>
          </div>
        </div>

        {fromStatus && data.status !== 'growing' && (
          <div className="card gdd-past-banner" style={{ marginBottom: '1.25rem' }}>
            <p className="gdd-past-banner-text">
              作付けを「{statusLabel(data.status)}」にしました。今シーズンの振り返りです。来年の計画にも使えます。
            </p>
          </div>
        )}

        <section className="card insights-intro" style={{ marginBottom: '1.25rem' }}>
          <p className="insights-intro-text">{data.headlineSummary}</p>
        </section>

        <section className="card insights-section">
          <h2 className="insights-section-title">概要</h2>
          <div className="insights-regional-stats">
            <div>
              <span className="insights-regional-stat-label">状態</span>
              <span className="insights-regional-stat-value">{statusLabel(data.status)}</span>
            </div>
            <div>
              <span className="insights-regional-stat-label">農場</span>
              <span className="insights-regional-stat-value">{data.farmName ?? '—'}</span>
            </div>
            <div>
              <span className="insights-regional-stat-label">栽培日数</span>
              <span className="insights-regional-stat-value">
                {data.seasonDays !== null ? `${data.seasonDays}日` : '—'}
              </span>
            </div>
          </div>
          <p className="insights-regional-meta" style={{ marginTop: '0.75rem' }}>
            植付{' '}
            {data.plantingDate ? formatDateShort(data.plantingDate) : '未設定'}
            {' 〜 '}
            {data.endDate ? formatDateShort(data.endDate) : '—'}
          </p>
        </section>

        <section className="card insights-section">
          <h2 className="insights-section-title">
            <span className="insights-layer-tag">あなた</span>
            収量・売上
          </h2>
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
                {data.harvestQty} {data.harvestUnit}
                {data.harvestCount > 0 ? `（${data.harvestCount}回）` : ''}
              </span>
              <span>
                {data.previousHarvestQty !== null
                  ? `${data.previousHarvestQty} ${data.harvestUnit}`
                  : '—'}
              </span>
              <span>{formatDiff(data.harvestDiffPct)}</span>
            </div>
            <div className="insights-compare-row">
              <span>売上</span>
              <span>{formatYen(data.salesAmount)}</span>
              <span>
                {data.previousSalesAmount !== null
                  ? formatYen(data.previousSalesAmount)
                  : '—'}
              </span>
              <span>{formatDiff(data.salesDiffPct)}</span>
            </div>
          </div>
          {data.previousLabel ? (
            <p className="insights-previous-label">
              前回：
              {data.previousCropId ? (
                <Link
                  href={`/crops/${data.previousCropId}/retrospective`}
                  className="text-green-700 hover:underline"
                >
                  {data.previousLabel}
                </Link>
              ) : (
                data.previousLabel
              )}
            </p>
          ) : (
            <p className="insights-previous-label text-gray-500">
              同名・同品種・同農場の前回作付けがありません
            </p>
          )}
          {(data.firstHarvestDate || data.lastHarvestDate) && (
            <p className="insights-regional-meta">
              収穫期間：
              {data.firstHarvestDate ? formatDateShort(data.firstHarvestDate) : '—'}
              {' 〜 '}
              {data.lastHarvestDate ? formatDateShort(data.lastHarvestDate) : '—'}
            </p>
          )}
        </section>

        <section className="card insights-section">
          <h2 className="insights-section-title">
            <span className="insights-layer-tag">あなた</span>
            作業・資材
          </h2>
          {data.workCount === 0 && data.pesticideCount === 0 && data.fertilizerCount === 0 ? (
            <p className="insights-regional-text">作業・農薬・施肥の記録はまだありません。</p>
          ) : (
            <>
              <div className="insights-regional-stats">
                <div>
                  <span className="insights-regional-stat-label">作業</span>
                  <span className="insights-regional-stat-value">{data.workCount}件</span>
                </div>
                <div>
                  <span className="insights-regional-stat-label">農薬</span>
                  <span className="insights-regional-stat-value">{data.pesticideCount}件</span>
                </div>
                <div>
                  <span className="insights-regional-stat-label">施肥</span>
                  <span className="insights-regional-stat-value">{data.fertilizerCount}件</span>
                </div>
              </div>
              {data.workByType.length > 0 && (
                <ul className="insights-hint-list" style={{ marginTop: '0.75rem' }}>
                  {data.workByType.map((w) => (
                    <li key={w.taskType}>
                      <strong>{w.taskType}</strong>：{w.count}回
                    </li>
                  ))}
                </ul>
              )}
              {data.recentWorks.length > 0 && (
                <p className="insights-regional-meta" style={{ marginTop: '0.75rem' }}>
                  直近の作業：
                  {data.recentWorks
                    .map((w) => `${formatDateShort(w.date)} ${w.taskType}`)
                    .join(' / ')}
                </p>
              )}
            </>
          )}
        </section>

        <section className="card insights-section">
          <h2 className="insights-section-title">
            <span className="insights-layer-tag">一般</span>
            目安・生育
          </h2>
          <p className="insights-regional-text">
            {data.yieldComment ??
              '一般目安との比較は、収量（kg）が記録されると表示されます。'}
          </p>
          <div className="insights-regional-stats" style={{ marginTop: '0.75rem' }}>
            <div>
              <span className="insights-regional-stat-label">積算温度（実績）</span>
              <span className="insights-regional-stat-value">
                {data.accumulatedGdd !== null ? `${data.accumulatedGdd}℃日` : '—'}
              </span>
            </div>
            <div>
              <span className="insights-regional-stat-label">目安GDD</span>
              <span className="insights-regional-stat-value">
                {data.targetGdd !== null ? `${data.targetGdd}℃日` : '—'}
              </span>
            </div>
          </div>
          {data.accumulatedGdd === null && (
            <p className="insights-regional-meta" style={{ marginTop: '0.5rem' }}>
              農場に緯度・経度と植付日があると積算温度を表示できます。
            </p>
          )}
        </section>

        <p className="insights-card-links" style={{ marginTop: '0.5rem' }}>
          <Link href={`/crops/${id}`} className="text-green-700 hover:underline text-sm">
            作物詳細 →
          </Link>
          {data.plantingDate && (
            <Link
              href={`/gdd?cropId=${id}`}
              className="text-green-700 hover:underline text-sm"
            >
              生育データ →
            </Link>
          )}
          <Link href="/insights/compare" className="text-green-700 hover:underline text-sm">
            作付け比較 →
          </Link>
          <Link
            href="/dashboard/ai-proposal"
            className="text-green-700 hover:underline text-sm"
          >
            今日の提案 →
          </Link>
        </p>
      </main>
    </div>
  )
}
