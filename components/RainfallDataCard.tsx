type RainPoint = {
  dayLabel: string
  precipitationMm: number
}

type CumPoint = {
  date: Date
  cumulativeMm: number
}

export default function RainfallDataCard({
  cropName,
  daysFromPlanting,
  currentCumulativeMm,
  targetCumulativeMm,
  historicalPoints,
  rainyDays,
  lastYearPoints = [],
  lastYearLabel = null,
}: {
  cropName: string
  daysFromPlanting: number
  currentCumulativeMm: number
  targetCumulativeMm: number
  historicalPoints: CumPoint[]
  rainyDays: RainPoint[]
  lastYearPoints?: { dayFromPlanting: number; value: number }[]
  lastYearLabel?: string | null
}) {
  const CHART_WIDTH = 2000
  const CHART_HEIGHT = 260
  const PAD_LEFT = 40
  const PAD_RIGHT = 88
  const PAD_TOP = 20
  const PAD_BOTTOM = 28
  const PLOT_W = CHART_WIDTH - PAD_LEFT - PAD_RIGHT
  const PLOT_H = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM
  const MAX_DAYS = 180

  const historyStart = historicalPoints[0]?.date
    ? new Date(new Date(historicalPoints[0].date).setHours(0, 0, 0, 0))
    : null
  const historyMaxDay =
    historyStart == null
      ? Math.max(0, Math.floor(daysFromPlanting))
      : Math.max(
          0,
          ...historicalPoints.map((p) => {
            const d = new Date(p.date)
            d.setHours(0, 0, 0, 0)
            return Math.floor((d.getTime() - historyStart.getTime()) / (24 * 60 * 60 * 1000))
          })
        )
  const displayDays = Math.max(
    10,
    Math.min(
      MAX_DAYS,
      Math.max(
        historyMaxDay || Math.max(10, Math.floor(daysFromPlanting)),
        lastYearPoints.length > 1
          ? Math.max(...lastYearPoints.map((p) => p.dayFromPlanting))
          : 0
      )
    )
  )

  const scaleX = (day: number): number => PAD_LEFT + (day / Math.max(1, displayDays)) * PLOT_W
  const scaleY = (mm: number, maxMm: number): number =>
    PAD_TOP + PLOT_H - (mm / Math.max(1, maxMm)) * PLOT_H

  const historicalSeriesRaw: [number, number][] =
    historyStart == null
      ? [[0, 0]]
      : historicalPoints.map((p) => {
          const d = new Date(p.date)
          d.setHours(0, 0, 0, 0)
          const day = Math.max(
            0,
            Math.floor((d.getTime() - historyStart.getTime()) / (24 * 60 * 60 * 1000))
          )
          return [Math.min(day, displayDays), p.cumulativeMm] as [number, number]
        })
  // 同じ日に複数点があると縦線になるので、最終値だけ残す
  const byDay = new Map<number, number>()
  for (const [day, mm] of [[0, 0] as [number, number], ...historicalSeriesRaw]) {
    byDay.set(day, mm)
  }
  const historicalSeries = Array.from(byDay.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, mm]) => [day, mm] as [number, number])

  const lastYearSeries = lastYearPoints
    .filter((p) => p.dayFromPlanting <= displayDays)
    .map((p) => [p.dayFromPlanting, p.value] as [number, number])
  const lastYearMax = lastYearSeries.length
    ? Math.max(...lastYearSeries.map(([, v]) => v))
    : 0

  const maxCum = Math.max(
    historicalSeries[historicalSeries.length - 1]?.[1] ?? 0,
    targetCumulativeMm,
    currentCumulativeMm,
    lastYearMax,
    20
  )
  // データ範囲に合わせて約4〜6本のY軸ラベルになるよう刻みを決める
  const chooseStep = (max: number): number => {
    if (max <= 50) return 10
    if (max <= 100) return 20
    if (max <= 250) return 50
    if (max <= 500) return 100
    if (max <= 1000) return 150
    return 200
  }
  const stepY = chooseStep(maxCum * 1.1)
  const maxRounded = Math.ceil((maxCum * 1.1) / stepY) * stepY

  const toPoints = (pairs: [number, number][]): string =>
    pairs.map(([d, mm]) => `${scaleX(d)},${scaleY(mm, maxRounded)}`).join(' ')

  const recentPath = toPoints(historicalSeries)
  const lastYearPath = lastYearSeries.length > 1 ? toPoints(lastYearSeries) : ''
  const standardSeries: [number, number][] = []
  for (let d = 0; d <= displayDays; d += 1) {
    standardSeries.push([d, targetCumulativeMm * 0.95 * (d / Math.max(displayDays, 90))])
  }
  const standardPath = toPoints(standardSeries)
  const gridY: number[] = []
  for (let y = 0; y <= maxRounded; y += stepY) gridY.push(y)
  const axisStep = Math.max(1, Math.round(displayDays / 3))
  const axisX = Array.from(new Set([0, axisStep, axisStep * 2, displayDays])).filter((d) => d <= displayDays)
  const thisDay = Math.max(0, Math.min(displayDays, Math.floor(daysFromPlanting)))
  const standardAtThisDay = targetCumulativeMm * 0.95 * (thisDay / Math.max(displayDays, 90))

  return (
    <section className="dashboard-card">
      <h2 className="dashboard-section-title">{cropName}の積算雨量の推移</h2>
      <p className="dashboard-section-sub">
        {cropName}の圃場地点に基づき、植え付け日から今日までの実績雨量を表示しています。
        {lastYearPath ? ' 灰色は前回作付けの積算雨量です。' : ''}
      </p>

      <div className="dashboard-gdd-graph">
        <div className="dashboard-gdd-graph-header">
          <span>植え付けからの推移（累積 mm）</span>
          <span className="dashboard-gdd-graph-current">現在：{currentCumulativeMm.toFixed(1)} mm</span>
        </div>
        <div className="dashboard-gdd-graph-body dashboard-gdd-graph-body--large">
          <svg className="dashboard-gdd-graph-svg" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
            {[0, ...axisX.filter((d) => d > 0)].map((d) => (
              <line key={`v-${d}`} x1={scaleX(d)} y1={PAD_TOP} x2={scaleX(d)} y2={CHART_HEIGHT - PAD_BOTTOM} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2 2" />
            ))}
            {gridY.map((mm) => (
              <line key={`h-${mm}`} x1={PAD_LEFT} y1={scaleY(mm, maxRounded)} x2={CHART_WIDTH - PAD_RIGHT} y2={scaleY(mm, maxRounded)} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2 2" />
            ))}
            {gridY.map((mm) => (
              <text
                key={`y-${mm}`}
                x={PAD_LEFT - 6}
                y={scaleY(mm, maxRounded) + 4}
                textAnchor="end"
                fontSize="10"
                fill="#6b7280"
              >
                {mm}
              </text>
            ))}
            {axisX.map((d) => (
              <text
                key={`x-${d}`}
                x={scaleX(d)}
                y={CHART_HEIGHT - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
              >
                {d === 0 ? '植え付け' : `+${d}日`}
              </text>
            ))}
            <polyline points={standardPath} fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="4 3" />
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
            <polyline points={recentPath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="dashboard-gdd-graph-marker">
            <div className="dashboard-gdd-graph-marker-row">
              <span className="dashboard-gdd-graph-dot dashboard-gdd-graph-dot--standard" />
              <span className="dashboard-gdd-graph-marker-text">標準：{Math.round(standardAtThisDay)} mm</span>
            </div>
            {lastYearPath && (
              <div className="dashboard-gdd-graph-marker-row">
                <span className="dashboard-gdd-graph-dot" style={{ backgroundColor: '#6B7280' }} />
                <span className="dashboard-gdd-graph-marker-text">
                  前回作付け{lastYearLabel ? `（${lastYearLabel}）` : ''}：{lastYearMax.toFixed(1)} mm
                </span>
              </div>
            )}
            <div className="dashboard-gdd-graph-marker-row">
              <span className="dashboard-gdd-graph-dot" style={{ backgroundColor: '#3b82f6' }} />
              <span className="dashboard-gdd-graph-marker-text dashboard-gdd-graph-marker-text--current">現在：{currentCumulativeMm.toFixed(1)} mm</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-gdd-summary">
        <p className="dashboard-gdd-summary-title">植え付け以降の累積雨量</p>
        <p className="dashboard-gdd-summary-text">
          同じ日付時点の標準積算雨量：<span className="font-semibold">{Math.round(standardAtThisDay)} mm</span>
          <br />
          → 今年は{' '}
          <span className="font-semibold text-blue-700">
            {Math.round(currentCumulativeMm - standardAtThisDay) >= 0 ? '+' : ''}
            {Math.round(currentCumulativeMm - standardAtThisDay)} mm
          </span>
          <br />
          経過日数：<span className="font-semibold">{Math.max(0, daysFromPlanting)} 日</span>
        </p>
      </div>

      <div className="dashboard-gdd-suggestions">
        <p className="dashboard-gdd-suggestions-title">強い雨が予報される日（20mm以上）</p>
        {rainyDays.length === 0 ? (
          <p className="dashboard-gdd-note">該当日はありません。</p>
        ) : (
          <ul className="dashboard-gdd-suggestions-list">
            {rainyDays.map((day) => (
              <li key={`${day.dayLabel}-${day.precipitationMm}`}>
                {day.dayLabel}: {day.precipitationMm.toFixed(1)} mm
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="dashboard-gdd-note">
        ※ 降雨前後は、防除・施肥・収穫タイミングを見直してください。単位は日降水量（mm）です。
      </p>
    </section>
  )
}
