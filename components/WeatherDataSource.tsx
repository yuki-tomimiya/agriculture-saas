import { JMA_SEARCH_TOP } from '@/lib/jma/thresholds'

type Kind = 'archive' | 'forecast' | 'mixed' | 'elevation'

function OpenMeteoLinks() {
  return <>
    <a href="https://open-meteo.com/" className="underline">Weather data by Open-Meteo.com</a>
    {' · '}<a href="https://creativecommons.org/licenses/by/4.0/" className="underline">CC BY 4.0</a>。
  </>
}

function ArchiveNote() {
  return <>過去の値は、2017年からは ECMWF（欧州中期予報センター）の数値予報モデル IFS の計算結果、2016年以前は<a href="https://climate.copernicus.eu/" className="underline">Copernicus Climate Change Service</a>の ERA5・ERA5-Land（再解析）です。</>
}

const forecastNote = '先の値は数値予報モデルの計算結果です。'

function ArchiveDisclaimer() {
  const year = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', year: 'numeric' }).format(new Date())
  return <p lang="en" className="mt-1 break-words">{`Contains modified Copernicus Climate Change Service information ${year}. Neither the European Commission nor ECMWF is responsible for any use that may be made of the Copernicus information or data it contains.`}</p>
}

function WeatherDisclaimer({ archive }: { archive: boolean }) {
  return <details className="mt-1 break-words">
    <summary className="cursor-pointer underline">出典・免責の原文</summary>
    <div lang="en" className="mt-1 space-y-1">
      <p>This service is based on data and products of the European Centre for Medium-Range Weather Forecasts (ECMWF).</p>
      <p>Source: <a href="https://www.ecmwf.int/" className="underline">www.ecmwf.int</a></p>
      <p>This ECMWF data is published under a <a href="https://creativecommons.org/licenses/by/4.0/" className="underline">Creative Commons Attribution 4.0 International (CC BY 4.0)</a>.</p>
      <p>Disclaimer: ECMWF does not accept any liability whatsoever for any error or omission in the data, their availability, or for any loss or damage arising from their use.</p>
    </div>
    <p>Open-Meteo を通して取得し、Tilltol で加工しています。<a href="https://open-meteo.com/en/licence" className="underline">気象データの提供元一覧</a></p>
    {archive && <div lang="en" className="mt-1 space-y-1">
      <ArchiveDisclaimer />
      <p>Copernicus Climate Change Service (2023): ERA5 hourly data on single levels from 1940 to present. Copernicus Climate Change Service (C3S) Climate Data Store (CDS). DOI: <a href="https://doi.org/10.24381/cds.adbb2d47" className="underline">10.24381/cds.adbb2d47</a></p>
      <p>Copernicus Climate Change Service (2019): ERA5-Land hourly data from 1950 to present. Copernicus Climate Change Service (C3S) Climate Data Store (CDS). DOI: <a href="https://doi.org/10.24381/cds.e2161bac" className="underline">10.24381/cds.e2161bac</a></p>
    </div>}
  </details>
}

export function CompactWeatherDataSource() {
  return <p className="text-xs text-gray-500 mt-2 mb-2 leading-relaxed"><OpenMeteoLinks />Tilltolで加工しています。</p>
}

export function WeatherDataNotes({ archive, forecast }: { archive: boolean; forecast: boolean }) {
  if (!archive && !forecast) return null
  return <section className="text-xs text-gray-500 mt-4 mb-2 leading-relaxed" aria-labelledby="morning-weather-source">
    <h2 id="morning-weather-source" className="font-semibold">天気のデータについて</h2>
    <p>{archive && <ArchiveNote />}{forecast && forecastNote}</p>
    <WeatherDisclaimer archive={archive} />
  </section>
}

/** 数値・カード・グラフのそばで共通の出典を表示する。クライアント側でも利用可。 */
export default function WeatherDataSource({ kind = 'archive' }: { kind?: Kind }) {
  return (
    <div className="text-xs text-gray-500 mt-2 mb-2 leading-relaxed">
      <p>
        <OpenMeteoLinks />
        {kind === 'elevation' ? <>農場の標高は<a href="https://doi.org/10.5270/ESA-c5d3d65" className="underline">Copernicus DEM</a>に基づきます。</> : <>
          Tilltolで平均・積算・日付の幅などに加工しています。
          {kind !== 'forecast' && <ArchiveNote />}
          {kind !== 'archive' && forecastNote}
        </>}
      </p>
      {kind === 'elevation' ? (
        <details className="mt-1">
          <summary className="cursor-pointer underline">出典・免責の原文</summary>
            <div lang="en" className="mt-1 break-words">
              <p>produced using Copernicus WorldDEM™-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved</p>
              <p className="mt-1">The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM™-90</p>
            </div>
        </details>
      ) : <WeatherDisclaimer archive={kind !== 'forecast'} />}
    </div>
  )
}

export function JmaDataSource() {
  return <p className="text-xs text-gray-500 mt-2 mb-2 leading-relaxed">出典：気象庁ホームページ『<a href={JMA_SEARCH_TOP} className="underline">過去の気象データ検索</a>』の日別値を加工して作成。</p>
}
