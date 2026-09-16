import Link from 'next/link'
import { getForecastDays, hasWeatherCoordinates } from '@/lib/weather-forecast'

type Props = {
  farmName?: string | null
  latitude?: number | null
  longitude?: number | null
  farmId?: string | null
  emptyState?: 'no-farms'
}

export default async function WeatherForecast({
  farmName,
  latitude,
  longitude,
  farmId,
  emptyState,
}: Props) {
  if (emptyState === 'no-farms') {
    return (
      <section className="dashboard-card">
        <h2 className="dashboard-section-title">今後2週間の気象情報</h2>
        <div className="dashboard-empty" style={{ padding: '1rem 0' }}>
          <p className="dashboard-empty-text">農場を登録し、地点を入力すると予報が表示されます。</p>
          <Link href="/farms/new" className="btn btn-primary">
            農場を追加
          </Link>
        </div>
      </section>
    )
  }

  if (!hasWeatherCoordinates({ latitude, longitude })) {
    return (
      <section className="dashboard-card">
        <h2 className="dashboard-section-title">今後2週間の気象情報</h2>
        <p className="dashboard-section-sub">
          拠点：{farmName ?? '—'}（地点未登録）
        </p>
        <div className="dashboard-empty" style={{ padding: '1rem 0' }}>
          <p className="dashboard-empty-text">
            緯度・経度が登録されると、この農場の地点に基づく2週間予報を表示します。
          </p>
          {farmId ? (
            <Link href={`/farms/${farmId}/edit`} className="btn btn-primary">
              農場の地点を登録
            </Link>
          ) : null}
        </div>
      </section>
    )
  }

  const forecastData = await getForecastDays({ latitude: latitude!, longitude: longitude! })

  return (
    <section className="dashboard-card">
      <h2 className="dashboard-section-title">今後2週間の気象情報</h2>
      <p className="dashboard-section-sub">
        拠点：{farmName ?? '未選択'}（北緯 {Number(latitude).toFixed(4)} / 東経 {Number(longitude).toFixed(4)}） ／ 本日から14日先までの日ごとの予報
      </p>
      {forecastData.length === 0 ? (
        <div className="dashboard-empty" style={{ padding: '1rem 0' }}>
          <p className="dashboard-empty-text">
            気象予報の取得に失敗しました。しばらくしてから再度お試しください。
          </p>
        </div>
      ) : (
        <ul className="dashboard-forecast-list dashboard-forecast-list--flow">
          {forecastData.slice(0, 14).map((item, idx) => (
            <li key={`${item.dayLabel}-${idx}`} className="dashboard-forecast-item">
              <div className="dashboard-forecast-main">
                <p className="dashboard-forecast-day">{item.dayLabel}</p>
                <p className="dashboard-forecast-weather">{item.weather}</p>
              </div>
              <div className="dashboard-forecast-meta">
                <p>{item.maxTemp}℃ / {item.minTemp}℃</p>
                <p className={item.precipitation >= 60 ? 'dashboard-forecast-alert' : ''}>
                  降水 {item.precipitation}%
                </p>
                {item.wind >= 10 && (
                  <p className="dashboard-forecast-alert">風速 {item.wind}m/s</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
