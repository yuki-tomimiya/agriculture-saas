import type { GDDProjectionResult } from '@/lib/gdd'

type Props = {
  cropName: string
  currentGDD: number
  targetGDD: number
  projection: GDDProjectionResult
}

export default function GDDForecastProposal({ cropName, currentGDD, targetGDD, projection }: Props) {
  const { targetReachDate, dailyProjections, suggestions } = projection
  const endGDD = dailyProjections.length > 0 ? dailyProjections[dailyProjections.length - 1].cumulativeGDD : currentGDD

  return (
    <section className="card gdd-forecast">
      <h2 className="gdd-forecast-title">予報を元にした今後の見通し</h2>
      <p className="gdd-forecast-desc">
        {cropName}について、現在の積算温度と今後14日間の気象予報から収穫時期の目安を算出しています。
      </p>

      <div className="gdd-forecast-summary">
        <div className="gdd-forecast-summary-row">
          <span className="gdd-forecast-label">現在の積算温度（今日まで）</span>
          <span className="gdd-forecast-value">{currentGDD} ℃日</span>
        </div>
        <div className="gdd-forecast-summary-row">
          <span className="gdd-forecast-label">目標（収穫適期の目安）</span>
          <span className="gdd-forecast-value">{targetGDD} ℃日</span>
        </div>
        <div className="gdd-forecast-summary-row">
          <span className="gdd-forecast-label">14日後時点の見込み累積</span>
          <span className="gdd-forecast-value gdd-forecast-value--accent">{Math.round(endGDD)} ℃日</span>
        </div>
        {targetReachDate && (
          <div className="gdd-forecast-summary-row gdd-forecast-summary-row--highlight">
            <span className="gdd-forecast-label">目標に達する見込み日</span>
            <span className="gdd-forecast-value">
              {targetReachDate.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })} 頃
            </span>
          </div>
        )}
      </div>

      {/* 日別見込み（簡易表） */}
      <details className="gdd-forecast-details">
        <summary className="gdd-forecast-details-summary">日別の積算温度見込み（今後14日間）</summary>
        <div className="overflow-x-auto">
          <table className="gdd-forecast-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>その日のGDD</th>
                <th>累積（見込み）</th>
              </tr>
            </thead>
            <tbody>
              {dailyProjections.map((row) => (
                <tr key={row.date.toISOString()}>
                  <td>{row.date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}</td>
                  <td>{row.dailyGDD} ℃日</td>
                  <td className="font-semibold">{row.cumulativeGDD} ℃日</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="gdd-forecast-suggestions">
        <h3 className="gdd-forecast-suggestions-title">提案</h3>
        <ul className="gdd-forecast-suggestions-list">
          {suggestions.map((text, i) => (
            <li key={i} className="gdd-forecast-suggestions-item" dangerouslySetInnerHTML={{ __html: text }} />
          ))}
        </ul>
      </div>

      <p className="gdd-forecast-note">
        ※ 見込みは気象予報に基づく参考値です。実際の気温で変動します。日々の気温データと連携すると精度が上がります。
      </p>
    </section>
  )
}
