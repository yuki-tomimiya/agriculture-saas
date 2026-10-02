import Link from 'next/link'

type CropForGDD = {
  id: string
  name: string
  variety: string | null
  plantingDate: Date | null
  baseTemperature: number | null
} | null

type ProjectionPoint = { date: Date; cumulativeGDD: number }
type LastYearPoint = { dayFromPlanting: number; value: number }

type GDDChartProps = {
  crop?: CropForGDD
  currentGDD?: number
  targetGDD?: number
  /** 赤線の意味。未指定のときは「目標」と書く */
  targetCaption?: string
  daysFromPlanting?: number
  historicalPoints?: ProjectionPoint[]
  dailyProjections?: ProjectionPoint[]
  /** 前回作付けの累積GDD（植付けからの日数で揃える） */
  lastYearPoints?: LastYearPoint[]
  lastYearLabel?: string | null
  /** 植付日からの平年積算温度。null は取得失敗。未指定は線も注記も出さない */
  normalGddByDay?: number[] | null
}

const CHART_WIDTH = 2000
const CHART_HEIGHT = 260
const PAD_LEFT = 40
const PAD_RIGHT = 88
const PAD_TOP = 20
const PAD_BOTTOM = 28
const PLOT_W = CHART_WIDTH - PAD_LEFT - PAD_RIGHT
const PLOT_H = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM
const MAX_DAYS = 180

function scaleX(day: number, maxDays: number): number {
  return PAD_LEFT + (day / Math.max(1, maxDays)) * PLOT_W
}

function scaleY(gdd: number, maxGDD: number): number {
  return PAD_TOP + PLOT_H - (gdd / Math.max(1, maxGDD)) * PLOT_H
}

function toPoints(pairs: [number, number][], maxGDD: number, maxDays: number): string {
  return pairs.map(([d, g]) => `${scaleX(d, maxDays)},${scaleY(g, maxGDD)}`).join(' ')
}

function daysFromBase(base: Date, date: Date): number {
  const b = new Date(base)
  b.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((d.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)))
}

/** 同じXに複数点がある場合は最後の値だけ残し、縦線化を防ぐ */
function dedupeByDay(pairs: [number, number][]): [number, number][] {
  const map = new Map<number, number>()
  for (const [day, value] of pairs) {
    map.set(day, value)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, value]) => [day, value])
}

function formatAxisDate(baseDate: Date | null, offsetDays: number): string {
  if (!baseDate) return offsetDays === 0 ? '植付' : `+${offsetDays}日`
  const d = new Date(baseDate)
  d.setDate(d.getDate() + offsetDays)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function chooseStep(maxValue: number): number {
  const steps = [10, 20, 25, 50, 100, 200, 250, 500]
  const raw = maxValue / 6
  for (const s of steps) {
    if (raw <= s) return s
  }
  return 500
}

export default function GDDChart({
  crop,
  currentGDD = 0,
  targetGDD = 1000,
  targetCaption,
  daysFromPlanting = 0,
  historicalPoints = [],
  dailyProjections = [],
  lastYearPoints = [],
  lastYearLabel = null,
  normalGddByDay,
}: GDDChartProps) {
  const cropLabel = crop ? `${crop.name}${crop.variety ? `（${crop.variety}）` : ''}` : '対象作物'
  const plantingStart = crop?.plantingDate
    ? new Date(new Date(crop.plantingDate).setHours(0, 0, 0, 0))
    : null

  const hasHistory = historicalPoints.length > 0
  const hasProjection = dailyProjections.length > 0
  const hasLastYear = lastYearPoints.length > 1
  const historyMaxDay = hasHistory
    ? Math.max(
        0,
        ...historicalPoints.map((p) =>
          plantingStart ? daysFromBase(plantingStart, p.date) : 0
        )
      )
    : Math.max(0, Math.floor(daysFromPlanting))
  const lastYearMaxDay = hasLastYear
    ? Math.max(...lastYearPoints.map((p) => p.dayFromPlanting))
    : 0
  const projectionDays = hasProjection ? dailyProjections.length : 0
  // 実データの最終日＋予報分までX軸を伸ばす（90日固定で末尾を潰さない）
  const dataEndDay = Math.max(historyMaxDay + projectionDays, lastYearMaxDay)
  const displayDays = Math.max(10, Math.min(MAX_DAYS, dataEndDay || 10))
  const normalPoints: [number, number][] =
    normalGddByDay && normalGddByDay.length > 0
      ? Array.from({ length: displayDays + 1 }, (_, d) => [
          d,
          normalGddByDay[Math.min(d, normalGddByDay.length - 1)] ?? 0,
        ])
      : []
  const normalMax = normalPoints.length > 0 ? Math.max(...normalPoints.map((point) => point[1])) : 0
  const historicalMaxGDD = hasHistory
    ? Math.max(currentGDD, ...historicalPoints.map((p) => p.cumulativeGDD))
    : currentGDD
  const lastYearMaxGDD = hasLastYear
    ? Math.max(...lastYearPoints.map((p) => p.value))
    : 0
  const projectedMaxGDD = hasProjection
    ? Math.max(...dailyProjections.map((p) => p.cumulativeGDD))
    : historicalMaxGDD
  const maxGDD = Math.max(
    30,
    historicalMaxGDD * 1.1,
    lastYearMaxGDD * 1.1,
    projectedMaxGDD * 1.05,
    normalMax * 1.05,
    targetGDD
  )
  const stepY = chooseStep(maxGDD)
  const maxGDDRounded = Math.ceil(maxGDD / stepY) * stepY

  let thisYearPoints: [number, number][] = [[0, 0]]
  let projectionPoints: [number, number][] = []
  let lastHistoryDay = 0
  if (hasHistory && plantingStart) {
    const historySeries = historicalPoints.map((p) => {
      const day = Math.min(displayDays, daysFromBase(plantingStart, p.date))
      return [day, p.cumulativeGDD] as [number, number]
    })
    thisYearPoints = dedupeByDay([[0, 0], ...historySeries])
  }
  lastHistoryDay = Math.max(0, Math.floor(thisYearPoints[thisYearPoints.length - 1]?.[0] ?? 0))
  if (hasProjection) {
    const anchor = thisYearPoints[thisYearPoints.length - 1] ?? [0, 0]
    const projected: [number, number][] = [anchor]
    dailyProjections.forEach((p, i) => {
      const day = lastHistoryDay + i + 1
      if (day <= displayDays) projected.push([day, p.cumulativeGDD])
    })
    projectionPoints = dedupeByDay(projected)
  }

  const normalPath = normalPoints.length > 1 ? toPoints(normalPoints, maxGDDRounded, displayDays) : ''
  const normalAtToday =
    normalGddByDay && normalGddByDay.length > 0
      ? normalGddByDay[Math.min(Math.max(0, Math.floor(daysFromPlanting)), normalGddByDay.length - 1)] ?? null
      : null
  const thisYearPath = toPoints(thisYearPoints, maxGDDRounded, displayDays)
  const projectionPath = projectionPoints.length > 1 ? toPoints(projectionPoints, maxGDDRounded, displayDays) : ''
  const lastYearPath = hasLastYear
    ? toPoints(
        dedupeByDay(
          lastYearPoints
            .filter((p) => p.dayFromPlanting <= displayDays)
            .map((p) => [p.dayFromPlanting, p.value] as [number, number])
        ),
        maxGDDRounded,
        displayDays
      )
    : ''

  const gridLinesY: number[] = []
  for (let y = 0; y <= maxGDDRounded; y += stepY) gridLinesY.push(y)
  const gridLinesX: number[] = []
  const stepX = Math.max(2, Math.round(displayDays / 6))
  for (let x = 0; x <= displayDays; x += stepX) gridLinesX.push(x)
  if (gridLinesX[gridLinesX.length - 1] !== displayDays) gridLinesX.push(displayDays)

  const lastThisYear = thisYearPoints[thisYearPoints.length - 1]
  const currentDay = Math.max(
    0,
    Math.min(displayDays, hasHistory ? Math.floor(lastThisYear?.[0] ?? 0) : Math.floor(daysFromPlanting))
  )
  const axisLabelDays = Array.from(new Set([0, Math.round(displayDays / 3), Math.round((displayDays * 2) / 3), displayDays]))
  const projectedGDD = dailyProjections[dailyProjections.length - 1]?.cumulativeGDD
  const currentProgressPct =
    targetGDD > 0 ? Math.max(0, (currentGDD / targetGDD) * 100) : 0
  const projectedProgressPct =
    projectedGDD != null && targetGDD > 0
      ? Math.max(0, (projectedGDD / targetGDD) * 100)
      : null
  const currentBarWidth = Math.min(100, currentProgressPct)
  const projectedBarWidth =
    projectedProgressPct != null ? Math.min(100, projectedProgressPct) : null

  const basisLabel = targetCaption ?? `目標 ${Math.round(targetGDD)}℃日`
  const suggestionItems =
    currentProgressPct >= 100
      ? [
          <>
            {basisLabel}に到達しています。圃場の様子を見て、<span className="font-semibold">収穫適期・出荷計画</span>
            を確認しましょう。
          </>,
          <>
            これからの天候（特に降雨）も踏まえ、<span className="font-semibold">掘り取りや選別の日程</span>
            を前倒しで調整すると安心です。
          </>,
        ]
      : currentProgressPct >= 70
        ? [
            <>
              {basisLabel}まで残りわずかです。<span className="font-semibold">収穫・出荷の準備</span>
              （人員・資材・保管）を早めに整えましょう。
            </>,
            <>
              高温や過湿が続く日は、<span className="font-semibold">生育・病害の見回り</span>
              を優先すると安心です。
            </>,
          ]
        : [
            <>
              生育前半〜中盤です。潅水や追肥のタイミングを、<span className="font-semibold">気象ナビの予報</span>
              とあわせて見直しましょう。
            </>,
            <>
              株の様子（葉色・草勢）を定期的に確認し、<span className="font-semibold">異常があれば作業記録</span>
              に残しておくと後から振り返りやすくなります。
            </>,
          ]

  return (
    <section className="dashboard-card">
      <h2 className="dashboard-section-title">
        {cropLabel}の積算温度（GDD）の推移
        <Link href="/faq#gdd" className="chart-help" aria-label="積算温度とは">？</Link>
      </h2>
      <p className="dashboard-section-sub">
        上段は実績（緑）と予報（青破線）
        {hasLastYear ? '、前回作付け（灰）' : ''}
        の累積推移、下段はこの基準までの進捗を表示します。
        {!crop && ' 作物一覧で植え付け日を登録した作物がここに表示されます。'}
        {crop && !hasHistory && ' この作物の農場に緯度・経度を登録すると、実データに基づく推移が表示されます。'}
      </p>

      <div className="dashboard-gdd-graph">
        <div className="dashboard-gdd-graph-header">
          <span>植え付けからの推移（累積 ℃日）</span>
          <span className="dashboard-gdd-graph-current">
            現在：{currentGDD} ℃日 / {basisLabel}
          </span>
        </div>
        <div className="dashboard-gdd-graph-body dashboard-gdd-graph-body--large">
          <svg className="dashboard-gdd-graph-svg" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
            {/* 縦グリッド */}
            {gridLinesX.map((d) => (
              <line
                key={`v-${d}`}
                x1={scaleX(d, displayDays)}
                y1={PAD_TOP}
                x2={scaleX(d, displayDays)}
                y2={CHART_HEIGHT - PAD_BOTTOM}
                stroke="#e5e7eb"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
            ))}
            {/* 横グリッド */}
            {gridLinesY.map((g) => (
              <line
                key={`h-${g}`}
                x1={PAD_LEFT}
                y1={scaleY(g, maxGDDRounded)}
                x2={CHART_WIDTH - PAD_RIGHT}
                y2={scaleY(g, maxGDDRounded)}
                stroke="#e5e7eb"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
            ))}
            {/* Y軸ラベル */}
            {gridLinesY.map((g) => (
              <text
                key={`y-${g}`}
                x={PAD_LEFT - 6}
                y={scaleY(g, maxGDDRounded) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#6b7280"
              >
                {g}
              </text>
            ))}
            {/* X軸ラベル */}
            {axisLabelDays.map((d) => (
              <text
                key={`x-${d}`}
                x={scaleX(d, displayDays)}
                y={CHART_HEIGHT - 8}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
              >
                {formatAxisDate(plantingStart, d)}
              </text>
            ))}
            {normalPath && (
              <polyline
                points={normalPath}
                fill="none"
                stroke="#D97706"
                strokeWidth="2"
                strokeDasharray="3 2"
              />
            )}
            {targetGDD > 0 && (
              <line
                x1={scaleX(0, displayDays)}
                x2={scaleX(displayDays, displayDays)}
                y1={scaleY(targetGDD, maxGDDRounded)}
                y2={scaleY(targetGDD, maxGDDRounded)}
                stroke="#DC2626"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
            )}
            {/* 前回作付け（昨年） */}
            {lastYearPath && (
              <polyline
                points={lastYearPath}
                fill="none"
                stroke="#9CA3AF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            )}
            {/* 今年（実績） */}
            <polyline
              points={thisYearPath}
              fill="none"
              stroke="#34D399"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 予報（明日以降） */}
            {projectionPath && (
              <polyline
                points={projectionPath}
                fill="none"
                stroke="#60A5FA"
                strokeWidth="2"
                strokeDasharray="4 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
              />
            )}
          </svg>
          <div
            className="dashboard-gdd-graph-marker"
            style={{
              position: 'absolute',
              top: 'auto',
              right: 'auto',
              left: '54%',
              bottom: '4.25rem',
              transform: 'translateX(-50%)',
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(1px)',
              border: '1px solid rgba(255,255,255,0.45)',
              borderRadius: '0.5rem',
              padding: '0.35rem 0.55rem',
              width: 'fit-content',
            }}
          >
            <div className="dashboard-gdd-graph-marker-row">
              <span className="dashboard-gdd-graph-dot" style={{ backgroundColor: '#34D399' }} />
              <span className="dashboard-gdd-graph-marker-text dashboard-gdd-graph-marker-text--current">
                現在：{Math.round(currentGDD)} ℃日
              </span>
            </div>
            {hasLastYear && (
              <div className="dashboard-gdd-graph-marker-row">
                <span className="dashboard-gdd-graph-dot" style={{ backgroundColor: '#9CA3AF' }} />
                <span className="dashboard-gdd-graph-marker-text">
                  前回作付け
                  {lastYearLabel ? `（${lastYearLabel}）` : ''}
                  ：{Math.round(lastYearMaxGDD)} ℃日
                </span>
              </div>
            )}
            {normalAtToday != null && (
              <div className="dashboard-gdd-graph-marker-row">
                <span className="dashboard-gdd-graph-dot" style={{ backgroundColor: '#D97706' }} />
                <span className="dashboard-gdd-graph-marker-text">
                  平年（過去10年平均）：{Math.round(normalAtToday)} ℃日
                </span>
              </div>
            )}
            {targetGDD > 0 && (
              <div className="dashboard-gdd-graph-marker-row">
                <span className="dashboard-gdd-graph-dot" style={{ backgroundColor: '#DC2626' }} />
                <span className="dashboard-gdd-graph-marker-text">{basisLabel}</span>
              </div>
            )}
            {projectedGDD != null && (
              <div className="dashboard-gdd-graph-marker-row">
                <span className="dashboard-gdd-graph-dot" style={{ backgroundColor: '#60A5FA' }} />
                <span className="dashboard-gdd-graph-marker-text">14日後見込み：{Math.round(projectedGDD)} ℃日</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {normalGddByDay !== undefined && (
        <p className="dashboard-gdd-note">
          {normalGddByDay == null
            ? '平年値を取得できなかったため、平年線は出していません。'
            : `平年＝この地点の過去10年平均（Open-Meteo）。赤の破線は${basisLabel}です。`}
        </p>
      )}

      <div className="dashboard-gdd-summary">
        <p className="dashboard-gdd-summary-title">基準までの進捗</p>
        <p className="dashboard-gdd-summary-text">
          進捗（現在）：<span className="font-semibold">{currentProgressPct.toFixed(1)}%</span>
          {projectedProgressPct != null && (
            <>
              {' '}／ 14日後見込み：<span className="font-semibold">{projectedProgressPct.toFixed(1)}%</span>
            </>
          )}
        </p>
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.4rem' }}>
          <div style={{ background: '#e5e7eb', borderRadius: 9999, height: 8 }}>
            <div
              style={{
                width: `${currentBarWidth}%`,
                background: '#16A34A',
                height: 8,
                borderRadius: 9999,
              }}
            />
          </div>
          {projectedBarWidth != null && (
            <div style={{ background: '#e5e7eb', borderRadius: 9999, height: 8 }}>
              <div
                style={{
                  width: `${projectedBarWidth}%`,
                  background: '#2563EB',
                  height: 8,
                  borderRadius: 9999,
                }}
              />
            </div>
          )}
        </div>
        {currentProgressPct > 100 && (
          <p className="dashboard-gdd-summary-text" style={{ marginTop: '0.5rem' }}>
            {basisLabel}を超えています（現在 {Math.round(currentGDD)} ℃日）。
          </p>
        )}
      </div>
      <div className="dashboard-gdd-suggestions">
        <p className="dashboard-gdd-suggestions-title">今すぐ検討したいこと</p>
        <ul className="dashboard-gdd-suggestions-list">
          {suggestionItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="dashboard-gdd-note">
        ※ 日々の気温データと連携すると積算温度が自動で更新されます。詳細な作物比較は生育ナビで確認できます。
      </p>
    </section>
  )
}
