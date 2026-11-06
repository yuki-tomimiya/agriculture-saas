import Link from 'next/link'
import { farmSoilPresentation, type SoilFarm } from '@/lib/farm-soil/presentation'
import { soilNutrientBasis } from '@/lib/farm-soil/classification'
import { manualSoilDescription, mapSoilDescription } from '@/lib/farm-soil/descriptions'
import { manualSoilOption } from '@/lib/farm-soil/options'
import { SOIL_EC_OVER_MS, SOIL_PHOSPHORUS_SKIP_MG } from '@/lib/benchmarks/soil-nutrients'
import FarmSoilEditor from './FarmSoilEditor'

export function SoilMapSource({ scale }: { scale: string | null | undefined }) {
  if (scale !== '50000' && scale !== '200000') return null
  const fine = scale === '50000'
  return <details className="mt-3 text-xs text-gray-500 leading-relaxed break-words">
    <summary className="cursor-pointer underline">土壌図の出典</summary>
    <p className="mt-2">出典：農研機構、日本土壌インベントリー（<a className="underline"
      href={fine ? 'https://soil-inventory.rad.naro.go.jp/download5.html' : 'https://soil-inventory.rad.naro.go.jp/download20.html'}>
      {fine ? '5万分の1農耕地包括土壌図' : '1/20万土壌図'}</a>）。{' '}
      <a className="underline" href="https://creativecommons.org/licenses/by/4.0/deed.ja">CC BY 4.0</a>。
      Tilltolで、農場の位置との照合と、普通畑の区分への当てはめのために加工しています。</p>
    <p className="mt-1">過去の調査に基づく地図の目安で、現在の畑の土を調べた結果ではありません。</p>
  </details>
}

function PreviousBasis() {
  return <details className="mt-2 text-sm text-gray-600">
    <summary className="cursor-pointer underline">これまでの目安とは</summary>
    <p className="mt-1">作付け前のECが{SOIL_EC_OVER_MS} mS/cmを超えた場合と、有効態リン酸が{SOIL_PHOSPHORUS_SKIP_MG} mg/100g以上の場合の目安です。この土に適した基準だと確認できたものではありません。</p>
  </details>
}

export function SoilDiagnosisBasis({ farm }: { farm: SoilFarm }) {
  const view = farmSoilPresentation(farm)
  return <div className="my-3 text-sm text-gray-600 break-words">
    <p>{view.soil.group === 'fallback' ? <>
      {view.soil.source === 'manual' && <>本人が選択：{view.soil.label}。 </>}{view.status}
    </> : soilNutrientBasis({ ...view.soil, label: view.soil.source === 'map' ? view.mapName ?? '土の名前未取得' : view.soil.label })}</p>
    <p className="mt-1">現在の土の種類で説明しています。農場の登録地点の目安を使っています。{' '}
      <Link className="text-green-700 underline" href={`/farms/${farm.id}#soil-type`}>土の種類を確認・直す（出典）</Link></p>
    {view.soil.group === 'fallback' && <PreviousBasis />}
  </div>
}

export default function FarmSoil({ farm }: { farm: SoilFarm }) {
  const view = farmSoilPresentation(farm)
  const manual = view.soil.source === 'manual' ? manualSoilOption(farm.soil?.manualSoilKey) : null
  const mapCanBeDescribed = view.mapName && farm.latitude != null && farm.longitude != null &&
    farm.soil?.manualStatus !== 'needs_review' && !/^[ACZ]/.test(farm.soil?.rawGroupCode?.trim() ?? '')
  const description = manual ? manualSoilDescription(manual.key)
    : mapCanBeDescribed ? mapSoilDescription(farm.soil?.rawSubgroupCode) : null
  return <section id="soil-type" className="bg-white p-4 sm:p-6 rounded-lg shadow mb-8 min-w-0 break-words scroll-mt-4">
    <h2 className="text-xl font-semibold mb-2">土の種類</h2>
    {view.soil.source === 'manual' ? <>
      <p>本人が選択：{view.soil.label}</p>
      {view.mapName && <p className="text-sm text-gray-500 mt-2">地図の推定：{view.mapName}（土壌図による目安）</p>}
    </> : view.mapName && <p>この場所の土は「{view.mapName}」（土壌図による目安）です。実際の畑と違う場合は直してください。</p>}
    {description && <p className="mt-2 text-sm text-gray-700">
      {description.broad && <>土の大きな分類についての説明{' '}</>}
      「{description.quote}」{' '}
      （<a className="text-green-700 underline" href={description.url}>農研機構 日本土壌インベントリー「土壌分類」</a>）
    </p>}
    <p className="mt-2 text-sm text-gray-700">{view.column
      ? `土の診断では、普通畑の「${view.column}」の列の目安を使います。`
      : view.status}</p>
    {view.soil.group === 'fallback' && <PreviousBasis />}
    <FarmSoilEditor key={`${farm.locationVersion}:${farm.soil?.manualStatus}:${farm.soil?.manualSoilKey}`}
      farmId={farm.id} initialKey={farm.soil?.manualSoilKey ?? 'unknown'} hasManual={farm.soil?.manualStatus === 'active' || farm.soil?.manualStatus === 'needs_review'} />
    <SoilMapSource scale={view.mapScale} />
  </section>
}
