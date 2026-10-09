import Link from 'next/link'
import { getForecastDays, hasWeatherCoordinates } from '@/lib/weather-forecast'
import { getLocationDailyNormals, meanNormalMaxTemp } from '@/lib/weather-normals'
import {
  FORECAST_RAIN_HIGHLIGHT_PCT,
  FORECAST_WIND_HIGHLIGHT_MS,
  tempCompareLabel,
} from '@/lib/weather-thresholds'

type Props = {
  farmName?: string | null
  latitude?: number | null
  longitude?: number | null
  /** 地点未登録時の「農場を編集」リンク先 */
  farmId?: string | null
  /** 農場が1件もないとき */
  emptyState?: 'no-farms'
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export default async function WeatherNav({
  farmName,
  latitude,
  longitude,
  farmId,
  emptyState,
}: Props) {
  if (emptyState === 'no-farms') {
    return (
      <section className="dashboard-weather-box">
        <div className="dashboard-weather-header">
          <div className="dashboard-weather-header-text">
            <h2>今週の気象ナビ</h2>
            <p>農場を登録し、農場情報で緯度・経度を入力すると、その地点の計算結果に基づいて表示されます。</p>
          </div>
        </div>
        <div className="dashboard-empty" style={{ padding: '1.25rem' }}>
          <p className="dashboard-empty-text">農場がまだありません</p>
          <Link href="/farms/new" className="btn btn-primary">
            農場を追加
          </Link>
        </div>
      </section>
    )
  }

  if (!hasWeatherCoordinates({ latitude, longitude })) {
    return (
      <section className="dashboard-weather-box">
        <div className="dashboard-weather-header">
          <div className="dashboard-weather-header-text">
            <h2>今週の気象ナビ</h2>
            <p>登録した緯度・経度の地点で、数値予報モデル（Open-Meteo）の計算結果を取得しています。</p>
          </div>
          <div className="dashboard-weather-tags">
            <span className="dashboard-weather-tag-gray">拠点：{farmName ?? '—'}（地点未登録）</span>
          </div>
        </div>
        <div className="dashboard-empty" style={{ padding: '1.25rem' }}>
          <p className="dashboard-empty-text">
            この農場の緯度・経度がまだ登録されていません。農場の編集画面で地点を入力すると、その地点の気象情報が表示されます。
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

  const forecast = await getForecastDays({ latitude: latitude!, longitude: longitude! })
  if (forecast.length === 0) {
    return (
      <section className="dashboard-weather-box">
        <div className="dashboard-weather-header">
          <div className="dashboard-weather-header-text">
            <h2>今週の気象ナビ</h2>
            <p>直近7日間の、数値予報モデル（Open-Meteo）の計算結果です。</p>
          </div>
          <div className="dashboard-weather-tags">
            <span className="dashboard-weather-tag-green">
              拠点：{farmName ?? '未選択'}（北緯 {Number(latitude).toFixed(4)} / 東経 {Number(longitude).toFixed(4)}）
            </span>
          </div>
        </div>
        <div className="dashboard-empty" style={{ padding: '1.25rem' }}>
          <p className="dashboard-empty-text">
            計算結果の取得に失敗しました。しばらくしてから再度お試しください。
          </p>
        </div>
      </section>
    )
  }

  const week = forecast.slice(0, 7)
  const avgMax = mean(week.map((d) => d.maxTemp))
  const avgRain = mean(week.map((d) => d.precipitation))
  const normals = await getLocationDailyNormals({
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
  })
  const normalMax = normals ? meanNormalMaxTemp(normals, week.map((d) => d.date)) : null
  const tempLabel = tempCompareLabel(avgMax, normalMax)
  // 週内で最も風が強い日（＝週内の最大風速）を注意日にも使う
  const windiestDay = week.reduce((best, d) => (d.wind > best.wind ? d : best), week[0])
  const maxWind = windiestDay.wind
  const heavyRainDay = week
    .filter((d) => d.precipitation >= FORECAST_RAIN_HIGHLIGHT_PCT)
    .sort((a, b) => b.precipitation - a.precipitation)[0]
  const strongWindDay = maxWind >= FORECAST_WIND_HIGHLIGHT_MS ? windiestDay : null

  return (
    <section className="dashboard-weather-box">
      <div className="dashboard-weather-header">
        <div className="dashboard-weather-header-text">
          <h2>今週の気象ナビ</h2>
          <p>直近7日間の、数値予報モデル（Open-Meteo）の計算結果です。</p>
        </div>
        <div className="dashboard-weather-tags">
          <span className="dashboard-weather-tag-green">
            拠点：{farmName ?? '未選択'}（北緯 {Number(latitude).toFixed(4)} / 東経 {Number(longitude).toFixed(4)}）
          </span>
          <span className="dashboard-weather-tag-gray">
            データ更新：約1時間ごと
          </span>
        </div>
      </div>
      <div className="dashboard-weather-nav">
        <div className="dashboard-weather-col dashboard-weather-col--green">
          <h3>今週の見通し</h3>
          <ul>
            <li>
              ・最高気温の週平均は <span className="font-semibold">{avgMax.toFixed(1)}℃</span>
              {tempLabel ? <> で、{tempLabel}です。</> : <>です。</>}
            </li>
            <li>・降水確率の週平均は <span className="font-semibold">{avgRain.toFixed(0)}%</span> です。</li>
            <li>
              ・週内の最大風速（日最大）は{' '}
              <span className="font-semibold">{maxWind.toFixed(1)}m/s</span>
              {windiestDay ? `（${windiestDay.dayLabel}）` : ''} です。
            </li>
          </ul>
        </div>
        <div className="dashboard-weather-col dashboard-weather-col--blue">
          <h3>取り上げる計算結果</h3>
          <ul>
            <li>
              ・降水確率{FORECAST_RAIN_HIGHLIGHT_PCT}%以上：
              <span className="font-semibold">
                {heavyRainDay
                  ? `${heavyRainDay.dayLabel}（降水確率 ${heavyRainDay.precipitation}%）`
                  : '該当する日はありません'}
              </span>
            </li>
            <li>
              ・最大風速{FORECAST_WIND_HIGHLIGHT_MS}m/s以上：
              <span className="font-semibold">
                {strongWindDay
                  ? `${strongWindDay.dayLabel}（日最大 ${strongWindDay.wind.toFixed(1)}m/s）`
                  : '該当する日はありません'}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
