import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { getCropSeasonRetrospective, getRetrospectiveGdd } from '@/lib/insights/crop-season-retrospective'
import { formatDateShort } from '@/lib/utils'
import NationalYieldNote from '@/components/NationalYieldNote'
import { DAYLENGTH_NOTE, isDaylengthCrop } from '@/lib/benchmarks/daylength-crops'

function formatYen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`
}

function formatDiff(pct: number | null): string {
  if (pct === null) return '—'
  if (pct > 0) return `+${pct}%`
  return `${pct}%`
}

function formatQty(recorded: boolean, qty: number, unit: string): string {
  if (!recorded) return '記録なし'
  return `${qty} ${unit}`
}

function formatSales(recorded: boolean, amount: number): string {
  if (!recorded) return '記録なし'
  return formatYen(amount)
}

async function RetrospectiveGddValue({ userId, cropId }: { userId: string; cropId: string }) {
  const gdd = await getRetrospectiveGdd(userId, cropId)
  return <>{gdd?.accumulatedGdd != null ? `${gdd.accumulatedGdd}℃日` : '—'}</>
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
            <h1 className="farms-title">{data.seasonTitle}</h1>
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
              作付けを「{statusLabel(data.status)}」にしました。{data.seasonTitle}です。来年の計画にも使えます。
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
                {formatQty(data.harvestCount > 0, data.harvestQty, data.harvestUnit)}
                {data.harvestCount > 0 ? `（${data.harvestCount}回）` : ''}
              </span>
              <span>
                {data.previousHarvestCount === null
                  ? '—'
                  : formatQty(data.previousHarvestCount > 0, data.previousHarvestQty ?? 0, data.harvestUnit)}
              </span>
              <span>{formatDiff(data.harvestDiffPct)}</span>
            </div>
            <div className="insights-compare-row">
              <span>売上</span>
              <span>{formatSales(data.salesCount > 0, data.salesAmount)}</span>
              <span>
                {data.previousSalesCount === null
                  ? '—'
                  : formatSales(data.previousSalesCount > 0, data.previousSalesAmount ?? 0)}
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
          <NationalYieldNote
            cropName={data.cropName}
            variety={data.variety}
            qty={data.harvestQty}
            unit={data.harvestUnit}
            areaM2={data.fieldAreaM2}
          />
          <div className="farm-new-actions" style={{ marginTop: '0.75rem' }}>
            {(data.harvestCount === 0 || data.harvestQty === 0) && (
              <Link
                href={`/harvests/new?cropId=${id}&returnTo=${encodeURIComponent(`/crops/${id}/retrospective`)}`}
                className="btn btn-primary"
              >
                収穫を記録する
              </Link>
            )}
            {data.salesCount === 0 && (
              <Link
                href={`/sales/new?cropId=${id}${data.farmId ? `&farmId=${data.farmId}` : ''}&returnTo=${encodeURIComponent(`/crops/${id}/retrospective`)}`}
                className="btn btn-outline"
              >
                売上を記録する
              </Link>
            )}
          </div>
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
                  <span className="insights-regional-stat-label">作業記録</span>
                  <span className="insights-regional-stat-value">{data.workCount}件</span>
                </div>
                <div>
                  <span className="insights-regional-stat-label">農薬記録</span>
                  <span className="insights-regional-stat-value">{data.pesticideCount}件</span>
                </div>
                <div>
                  <span className="insights-regional-stat-label">施肥記録</span>
                  <span className="insights-regional-stat-value">{data.fertilizerCount}件</span>
                </div>
              </div>
              {data.workByType.some((w) => w.taskType.includes('追肥') || w.taskType.includes('施肥')) && (
                <p className="insights-regional-meta" style={{ marginTop: '0.75rem' }}>
                  作業の「追肥」は作業記録です。肥料の量を残す施肥記録とは別です。
                </p>
              )}
              {data.workByType.length > 0 && (
                <ul className="insights-hint-list" style={{ marginTop: '0.35rem' }}>
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
          <div className="insights-regional-stats">
            <div>
              <span className="insights-regional-stat-label">
                {data.gddAsOf === 'harvest' ? '積算温度（収穫日時点）' : '積算温度（今日まで）'}
              </span>
              <span className="insights-regional-stat-value">
                <Suspense fallback={<span>集計中…</span>}>
                  <RetrospectiveGddValue userId={user.id} cropId={id} />
                </Suspense>
              </span>
            </div>
            {!isDaylengthCrop(data.cropName, data.variety) && (
            <div>
              <span className="insights-regional-stat-label">
                {data.gddBasis?.source === 'provisional' ? '一般の目安（暫定）' : '収穫時点の実績'}
              </span>
              <span className="insights-regional-stat-value">
                {data.gddBasis ? `${data.gddBasis.gdd}℃日` : '—'}
              </span>
            </div>
            )}
          </div>
          {isDaylengthCrop(data.cropName, data.variety) ? (
            <p className="insights-regional-meta" style={{ marginTop: '0.5rem' }}>
              {DAYLENGTH_NOTE}
            </p>
          ) : data.gddBasis && (
            <p className="insights-regional-meta" style={{ marginTop: '0.5rem' }}>
              {data.gddBasis.summary}
              {data.gddBasis.detail ? `。${data.gddBasis.detail}` : ''}
              {data.gddBasis.spreadNote ? `。${data.gddBasis.spreadNote}` : '。'}
            </p>
          )}
          {data.gddAsOf === null && (
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
              href={`/gdd/${id}`}
              className="text-green-700 hover:underline text-sm"
            >
              生育データ →
            </Link>
          )}
          <Link href={`/plan#plan-${id}`} className="text-green-700 hover:underline text-sm">
            来年の計画へ →
          </Link>
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
