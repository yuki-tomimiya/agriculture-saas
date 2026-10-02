import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import { defaultBaseTemperature } from '@/lib/benchmarks/base-temperature'

type Crop = {
  id: string
  name: string
  variety: string | null
  plantingDate: Date | null
  harvestDate: Date | null
  status: string
  baseTemperature: number | null
  farm: { name: string } | null
}

function sortByPlantingDesc(a: Crop, b: Crop): number {
  const ta = a.plantingDate?.getTime() ?? 0
  const tb = b.plantingDate?.getTime() ?? 0
  return tb - ta
}

function CropCard({
  crop,
  selectedCropId,
}: {
  crop: Crop
  selectedCropId?: string
}) {
  const selected = crop.id === selectedCropId
  return (
    <li
      className="gdd-crop-card"
      style={selected ? { borderColor: '#16a34a', boxShadow: '0 0 0 1px #16a34a inset' } : undefined}
    >
      <div className="gdd-crop-card-main">
        <Link href={`/crops/${crop.id}`} className="gdd-crop-card-name">
          {crop.name}
          {crop.variety ? `（${crop.variety}）` : ''}
        </Link>
        <span className="gdd-crop-card-meta">
          {crop.farm?.name ?? '農場未設定'} ・ 植え付け{' '}
          {crop.plantingDate ? formatDateShort(crop.plantingDate) : '-'}
        </span>
      </div>
      <div className="gdd-crop-card-extra">
        <Link href="/faq#base-temp" className="gdd-crop-card-base">
          基準温度 {crop.baseTemperature ?? 10}℃
        </Link>
        {(() => {
          const usual = defaultBaseTemperature(crop.name, crop.variety)
          const shown = crop.baseTemperature ?? 10
          if (usual == null || shown === usual) return null
          return <span className="gdd-crop-card-meta">一般値は{usual}℃</span>
        })()}
        <span className="gdd-crop-card-status">栽培中</span>
        <Link
          href={`/gdd?cropId=${crop.id}#gdd-detail`}
          className="btn btn-outline"
          style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
        >
          {selected ? '選択中' : 'この作物で見る'}
        </Link>
      </div>
    </li>
  )
}

export default function GDDCropList({
  crops,
  selectedCropId,
}: {
  crops: Crop[]
  selectedCropId?: string
}) {
  const growing = crops.filter((c) => c.status === 'growing')
  const growingWithPlanting = growing
    .filter((c) => c.plantingDate != null)
    .sort(sortByPlantingDesc)
  const growingWithoutPlanting = growing.filter((c) => c.plantingDate == null)
  const pastCount = crops.filter(
    (c) => c.plantingDate != null && c.status !== 'growing'
  ).length

  if (crops.length === 0) {
    return null
  }

  return (
    <section className="card gdd-crop-list">
      <h2 className="gdd-section-title">栽培中の作物</h2>
      <p className="gdd-crop-list-desc">
        いま栽培中の作付けの進捗確認用です。過去作付けの生育データは下のリンクから開けます。
      </p>

      {growingWithPlanting.length > 0 ? (
        <ul className="gdd-crop-cards">
          {growingWithPlanting.map((crop) => (
            <CropCard key={crop.id} crop={crop} selectedCropId={selectedCropId} />
          ))}
        </ul>
      ) : (
        <p className="gdd-crop-list-empty">
          栽培中（植え付け日あり）の作物はありません。
          {pastCount > 0
            ? '過去の生育データは下から確認できます。'
            : '作物を登録し、植え付け日を設定してください。'}
        </p>
      )}

      {pastCount > 0 && (
        <p className="gdd-crop-past-link">
          <Link href="/gdd/past" className="gdd-crop-past-link-a">
            過去の生育データを見る（{pastCount}）→
          </Link>
          <span className="gdd-crop-past-link-hint">生育ナビの下の階層</span>
        </p>
      )}

      {growingWithoutPlanting.length > 0 && (
        <div className="gdd-crop-list-other">
          <p className="gdd-crop-list-other-title">植え付け日未設定（栽培中）</p>
          <ul className="gdd-crop-list-other-list">
            {growingWithoutPlanting.map((crop) => (
              <li key={crop.id}>
                <Link href={`/crops/${crop.id}/edit`} className="gdd-crop-list-other-link">
                  {crop.name}
                </Link>
                に植え付け日を設定すると、積算温度を表示できます
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
