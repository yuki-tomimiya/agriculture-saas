import Link from 'next/link'

type CropForSunshine = {
  id: string
  name: string
  variety: string | null
  plantingDate: Date | null
} | null

function formatPlantingLabel(date: Date | null): string {
  if (!date) return '植え付け'
  return `植え付け（${date.getMonth() + 1}/${date.getDate()}）`
}

type RadiationPoint = { date: Date; cumulativeRadiationMj: number }

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

function scaleY(hours: number, maxHours: number): number {
  return PAD_TOP + PLOT_H - (hours / Math.max(1, maxHours)) * PLOT_H
}

function toPoints(pairs: [number, number][], maxHours: number, maxDays: number): string {
  return pairs.map(([d, h]) => `${scaleX(d, maxDays)},${scaleY(h, maxHours)}`).join(' ')
}

export default function SunshineChart({
  crop,
  daysFromPlanting = 0,
  historicalPoints = [],
  lastYearPoints = [],
  lastYearLabel = null,
  normalCumulativeMj = null,
}: {
  crop?: CropForSunshine
  daysFromPlanting?: number
  historicalPoints?: RadiationPoint[]
  lastYearPoints?: { dayFromPlanting: number; value: number }[]
  lastYearLabel?: string | null
  normalCumulativeMj?: number[] | null
}) {
  const cropLabel = crop ? `${crop.name}${crop.variety ? `（${crop.variety}）` : ''}` : '対象作物'
  const currentRadiation = historicalPoints[historicalPoints.length - 1]?.cumulativeRadiationMj ?? 0
  const plantingStart = crop?.plantingDate
    ? new Date(new Date(crop.plantingDate).setHours(0, 0, 0, 0))
    : null
  const hasHistory = historicalPoints.length > 0 && plantingStart != null
  const hasLastYear = lastYearPoints.length > 1
  const historyMaxDay = hasHistory
    ? Math.max(
        0,
        ...historicalPoints.map((p) =>
          Math.floor((p.date.getTime() - plantingStart.getTime()) / (24 * 60 * 60 * 1000))
        )
      )
    : Math.max(0, Math.floor(daysFromPlanting))
  const lastYearMaxDay = hasLastYear
    ? Math.max(...lastYearPoints.map((p) => p.dayFromPlanting))
    : 0
  const displayDays = Math.max(10, Math.min(MAX_DAYS, Math.max(historyMaxDay, lastYearMaxDay) || 10))

  const lastYearMax = hasLastYear ? Math.max(...lastYearPoints.map((p) => p.value)) : 0
  const normalAtToday =
    normalCumulativeMj && normalCumulativeMj.length > 0
      ? normalCumulativeMj[Math.min(Math.max(0, Math.floor(daysFromPlanting ?? 0)), normalCumulativeMj.length - 1)] ?? null
      : null
  const normalMax =
    normalCumulativeMj && normalCumulativeMj.length > 0 ? Math.max(...normalCumulativeMj.slice(0, displayDays + 1)) : 0
  const maxHoursRounded = Math.max(
    200,
    Math.ceil(Math.max(currentRadiation, normalMax, lastYearMax) * 1.1 / 100) * 100
  )
  const chooseStep = (max: number): number => {
    if (max <= 200) return 50
    if (max <= 500) return 100
    if (max <= 1000) return 200
    return 250
  }
  const stepY = chooseStep(maxHoursRounded)
  const gridY: number[] = []
  for (let y = 0; y <= maxHoursRounded; y += stepY) gridY.push(y)

  const standardLine: [number, number][] =
    normalCumulativeMj && normalCumulativeMj.length > 0
      ? Array.from({ length: displayDays + 1 }, (_, d) => [
          d,
          normalCumulativeMj[Math.min(d, normalCumulativeMj.length - 1)] ?? 0,
        ])
      : []

  const thisYearLineRaw: [number, number][] = hasHistory
    ? historicalPoints.map((p) => {
        const day = Math.max(
          0,
          Math.floor((p.date.getTime() - plantingStart.getTime()) / (24 * 60 * 60 * 1000))
        )
        return [Math.min(day, displayDays), p.cumulativeRadiationMj]
      })
    : [[0, 0]]
  const byDay = new Map<number, number>()
  for (const [day, value] of [[0, 0] as [number, number], ...thisYearLineRaw]) {
    byDay.set(day, value)
  }
  const thisYearLine = Array.from(byDay.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, value]) => [day, value] as [number, number])

  const standardPath = standardLine.length > 1 ? toPoints(standardLine, maxHoursRounded, displayDays) : ''
  const thisYearPath = toPoints(thisYearLine, maxHoursRounded, displayDays)
  const lastYearPath = hasLastYear
    ? toPoints(
        lastYearPoints
          .filter((p) => p.dayFromPlanting <= displayDays)
          .map((p) => [p.dayFromPlanting, p.value] as [number, number]),
        maxHoursRounded,
        displayDays
      )
    : ''
  const axisStep = Math.max(1, Math.round(displayDays / 3))
  const axisX = Array.from(new Set([0, axisStep, axisStep * 2, displayDays])).filter((d) => d <= displayDays)

  return (
    <section className="dashboard-card">
      <h2 className="dashboard-section-title">
        {cropLabel}の積算日射量の推移
        <Link href="/faq#radiation" className="chart-help" aria-label="日射量の単位とは">？</Link>
      </h2>
      <p className="dashboard-section-sub">
        植え付け日からの積算日射量（実データ）の推移を、平年と今年
        {hasLastYear ? '・前回作付け' : ''}
        で比較して表示します。
        {crop && !hasHistory && ' この作物の農場に緯度・経度を登録すると、実データに基づく推移が表示されます。'}
      </p>
      <div className="dashboard-gdd-graph">
        <div className="dashboard-gdd-graph-header">
          <span>植え付けからの推移（累積 MJ/㎡）</span>
          <span className="dashboard-gdd-graph-current">
            現在：{currentRadiation} MJ/㎡
            {normalAtToday != null ? ` / 平年：${Math.round(normalAtToday)} MJ/㎡` : ''}
          </span>
        </div>
        <div className="dashboard-gdd-graph-body dashboard-gdd-graph-body--large">
          <svg className="dashboard-gdd-graph-svg" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
            {axisX.map((d) => (
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
            {gridY.map((h) => (
              <line
                key={`h-${h}`}
                x1={PAD_LEFT}
                y1={scaleY(h, maxHoursRounded)}
                x2={CHART_WIDTH - PAD_RIGHT}
                y2={scaleY(h, maxHoursRounded)}
                stroke="#e5e7eb"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
            ))}
            {gridY.map((h) => (
              <text
                key={`y-${h}`}
                x={PAD_LEFT - 6}
                y={scaleY(h, maxHoursRounded) + 4}
                textAnchor="end"
                fontSize="10"
                fill="#6b7280"
              >
                {h}
              </text>
            ))}
            {axisX.map((d) => (
              <text
                key={`x-${d}`}
                x={scaleX(d, displayDays)}
                y={CHART_HEIGHT - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
              >
                {d === 0 ? formatPlantingLabel(crop?.plantingDate ?? null) : `+${d}日`}
              </text>
            ))}
            {standardPath && (
              <polyline
                points={standardPath}
                fill="none"
                stroke="#D97706"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            )}
            {lastYearPath && (
              <polyline
                points={lastYearPath}
                fill="none"
                stroke="#6B7280"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <polyline
              points={thisYearPath}
              fill="none"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="dashboard-gdd-graph-marker">
            <div className="dashboard-gdd-graph-marker-row">
              <span className="dashboard-gdd-graph-dot" style={{ backgroundColor: '#f97316' }} />
              <span className="dashboard-gdd-graph-marker-text dashboard-gdd-graph-marker-text--current">
                今年：{currentRadiation} MJ/㎡
              </span>
            </div>
            {hasLastYear && (
              <div className="dashboard-gdd-graph-marker-row">
                <span className="dashboard-gdd-graph-dot" style={{ backgroundColor: '#6B7280' }} />
                <span className="dashboard-gdd-graph-marker-text">
                  前回作付け{lastYearLabel ? `（${lastYearLabel}）` : ''}：{lastYearMax} MJ/㎡
                </span>
              </div>
            )}
            <div className="dashboard-gdd-graph-marker-row">
              <span className="dashboard-gdd-graph-dot dashboard-gdd-graph-dot--standard" />
              <span className="dashboard-gdd-graph-marker-text">
                {normalAtToday != null ? `平年（過去10年平均）：${Math.round(normalAtToday)} MJ/㎡` : '平年値なし'}
              </span>
            </div>
          </div>
        </div>

        <div className="dashboard-gdd-summary">
          <p className="dashboard-gdd-summary-title">日射量の傾向</p>
          <p className="dashboard-gdd-summary-text">
            {normalAtToday != null ? (
              <>
                同じ日付時点の平年積算日射量：<span className="font-semibold">{Math.round(normalAtToday)} MJ/㎡</span>
                <br />→ 今年は平年より{' '}
                <span className="font-semibold text-orange-600">
                  {currentRadiation - normalAtToday >= 0 ? '+' : ''}
                  {Math.round((currentRadiation - normalAtToday) * 10) / 10} MJ/㎡
                  {normalAtToday > 0 ? `（平年の${Math.round((currentRadiation / normalAtToday) * 100)}%）` : ''}
                </span>
              </>
            ) : (
              <>平年値を取得できなかったため、比較線は出していません。</>
            )}
          </p>
          <p className="dashboard-gdd-note">平年＝この地点の過去10年平均（Open-Meteo）。
          </p>
        </div>
      </div>
    </section>
  )
}

