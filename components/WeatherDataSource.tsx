import { JMA_SEARCH_TOP } from '@/lib/jma/thresholds'

type Kind = 'archive' | 'forecast' | 'mixed' | 'elevation'

/** 数値・カード・グラフのそばで共通の出典を表示する。クライアント側でも利用可。 */
export default function WeatherDataSource({ kind = 'archive' }: { kind?: Kind }) {
  return (
    <p className="text-xs text-gray-500 mt-2 mb-2 leading-relaxed">
      <a href="https://open-meteo.com/" className="underline">Weather data by Open-Meteo.com</a>
      {' · '}<a href="https://creativecommons.org/licenses/by/4.0/" className="underline">CC BY 4.0</a>。
      {kind === 'elevation' ? <>農場の標高は<a href="https://doi.org/10.5270/ESA-c5d3d65" className="underline">Copernicus DEM</a>に基づきます。</> : <>
        Tilltoで平均・積算・日付の幅などに加工しています。
        {kind !== 'forecast' && <>過去の値は<a href="https://climate.copernicus.eu/" className="underline">Copernicus Climate Change Service</a>のERA5などに基づく再解析です。</>}
        {kind !== 'archive' && <>先の値は数値予報モデルの計算結果です。</>}
      </>}
    </p>
  )
}

export function JmaDataSource() {
  return <p className="text-xs text-gray-500 mt-2 mb-2 leading-relaxed">出典：気象庁ホームページ『<a href={JMA_SEARCH_TOP} className="underline">過去の気象データ検索</a>』の日別値を加工して作成。</p>
}
