import Link from 'next/link'
import { japanDateKey } from '@/lib/pesticide-safety'

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

/** 作物選択・絞り込みの表示名。 */
export function formatCropOptionLabel(crop: {
  name: string
  variety?: string | null
  plantingDate?: Date | null
  farmName?: string | null
}): string {
  const planted = crop.plantingDate ? `${japanDateKey(crop.plantingDate).replaceAll('-', '/')} 植付` : null
  const label = [crop.name, crop.variety?.trim(), planted].filter(Boolean).join('・')
  return crop.farmName ? `${label}（${crop.farmName}）` : label
}
