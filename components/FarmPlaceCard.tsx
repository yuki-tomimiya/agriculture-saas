import { SoilMapSource } from '@/components/FarmSoil'
import WeatherDataSource, { CompactWeatherDataSource, JmaDataSource, WeatherDataNotes } from '@/components/WeatherDataSource'
import type { PlaceCard } from '@/lib/farms/place-card'

const missingNotes: Record<PlaceCard['missing'][number], string> = {
  autumn_frost: '秋の初霜の時期は取得できませんでした。',
  spring_frost: '春の終霜の時期は取得できませんでした。',
  estimated_frost: '観測所の記録が使えない時期の霜は推計です。海沿いでは実際より遅く見えることがあります。',
  normal: '10年平均の気温は取得できませんでした。',
  soil: 'この場所の土の種類は、土壌図からはまだ出せません。',
}

export default function FarmPlaceCard({
  card, onRetryWeather, retryDisabled,
}: {
  card: PlaceCard
  onRetryWeather: () => void
  retryDisabled: boolean
}) {
  const { frost, normal, soil, missing } = card
  const observed = frost.autumn?.source === 'station' || frost.spring?.source === 'station'
  const estimated = frost.autumn?.source === 'estimate' || frost.spring?.source === 'estimate'
  const unavailable = missing.filter(item => item !== 'estimated_frost')
  return (
    <section aria-labelledby="land-card-heading" className="rounded-lg border border-green-200 bg-green-50/40 p-2 sm:p-4">
      <h2 id="land-card-heading" className="text-lg font-semibold">この土地のカード</h2>
      {unavailable.length > 0 && (
        <p className="mt-2 text-sm text-gray-700">
          <strong>この場所でまだ出ないもの</strong>{' '}
          {unavailable.map(item => item === 'soil' && soil.status === 'ambiguous'
            ? '土壌図の区画の境目などのため、土の種類を1つに絞れません。'
            : missingNotes[item]).join('')}
        </p>
      )}
      {missing.some(item => item === 'autumn_frost' || item === 'spring_frost' || item === 'normal') && (
        <button type="button" className="btn btn-outline mt-2 max-w-full whitespace-normal !px-2"
          onClick={onRetryWeather} disabled={retryDisabled}>もう一度取る</button>
      )}
      <div className="mt-3 space-y-3 divide-y divide-green-100">
        {(frost.autumn || frost.spring) && <section>
          <h3 className="font-semibold">霜</h3>
          {frost.stationLine && <p className="mt-1 text-sm">{frost.stationLine}</p>}
          {frost.autumn && <p className="mt-1 text-sm">{frost.autumn.text}</p>}
          {frost.spring && <p className="mt-1 text-sm">{frost.spring.text}</p>}
          {estimated && <p className="mt-1 text-sm">{missingNotes.estimated_frost}</p>}
          {observed && <JmaDataSource />}
          {estimated && <CompactWeatherDataSource />}
          {frost.usesElevation && <WeatherDataSource kind="elevation" />}
        </section>}
        {normal && <section className="pt-3">
          <h3 className="font-semibold">10年平均（地域区分）</h3>
          <p className="mt-1 text-sm">{normal.text}</p>
          <CompactWeatherDataSource />
          <p className="text-xs text-gray-600">
            出典：{normal.source.publisher}『<a className="underline" href={normal.source.url}>{normal.source.name}</a>』{normal.source.detail}
          </p>
        </section>}
        {soil.status === 'matched' && <section className="pt-3">
          <h3 className="font-semibold">土の種類</h3>
          {soil.name && <p className="mt-1 text-sm">この場所の土は「{soil.name}」（土壌図による目安）です。</p>}
          <p className="mt-1 text-sm">{soil.column
            ? `土の診断では、普通畑の「${soil.column}」の列の目安を使います。`
            : 'この土と普通畑の基準表との対応は確認できていません。'}</p>
          <SoilMapSource scale={soil.scale} />
        </section>}
      </div>
      <WeatherDataNotes archive={estimated || normal != null} forecast={false} />
    </section>
  )
}
