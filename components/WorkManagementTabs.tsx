import Link from 'next/link'

type WorkManagementTab = 'work-records' | 'fertilizers'

export function WorkManagementTabs({
  active,
  queryString = '',
  mode = 'list',
}: {
  active: WorkManagementTab
  queryString?: string
  /** list: 一覧同士 / new: 新規登録同士 */
  mode?: 'list' | 'new'
}) {
  const suffix = queryString ? `?${queryString}` : ''
  const workHref =
    mode === 'new' ? `/work-records/new${suffix}` : `/work-records${suffix}`
  const fertilizerHref =
    mode === 'new' ? `/fertilizers/new${suffix}` : `/fertilizers${suffix}`

  return (
    <div className="work-management-tabs" role="tablist" aria-label="作業管理">
      <Link
        href={workHref}
        role="tab"
        aria-selected={active === 'work-records'}
        className={`work-management-tab${
          active === 'work-records' ? ' work-management-tab--active' : ''
        }`}
      >
        📝 作業記録
      </Link>
      <Link
        href={fertilizerHref}
        role="tab"
        aria-selected={active === 'fertilizers'}
        className={`work-management-tab${
          active === 'fertilizers' ? ' work-management-tab--active' : ''
        }`}
      >
        🌿 施肥記録
      </Link>
    </div>
  )
}

export function buildWorkManagementQuery(params: {
  cropId?: string
  farmId?: string
}): string {
  const search = new URLSearchParams()
  if (params.cropId) search.set('cropId', params.cropId)
  if (params.farmId) search.set('farmId', params.farmId)
  return search.toString()
}

/** 作物セレクト用の表示名（品種・農場で判別しやすくする） */
export function formatCropOptionLabel(crop: {
  name: string
  variety?: string | null
  farmName?: string | null
}): string {
  const variety = crop.variety?.trim()
  const withVariety = variety ? `${crop.name}（${variety}）` : crop.name
  return crop.farmName ? `${withVariety} / ${crop.farmName}` : withVariety
}
