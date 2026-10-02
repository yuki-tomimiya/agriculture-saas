import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { daysSincePlanting, formatDateShort } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'

type CropListItem = {
  id: string
  name: string
  variety: string | null
  status: string
  plantingDate: Date | null
  harvestDate: Date | null
  farm: { id: string; name: string } | null
  field: { id: string; name: string } | null
  _count: { harvests: number; tasks: number; workRecords: number }
}

export default async function CropsPage({
  searchParams,
}: {
  searchParams?: Promise<{ farmId?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const sp = searchParams ? await searchParams : undefined
  const farmId = sp?.farmId

  const include = {
    farm: true,
    field: true,
    _count: {
      select: {
        harvests: true,
        tasks: true,
        workRecords: true,
      },
    },
  } as const
  const orderBy = { plantingDate: 'desc' as const }

  const { where, whereFallback } = getCropWhere(user.id, { farmId })
  const growingWhere = { AND: [where, { status: 'growing' }] }
  const growingFallback = { AND: [whereFallback, { status: 'growing' }] }

  let crops: CropListItem[]
  try {
    crops = (await prisma.crop.findMany({
      where: growingWhere,
      include,
      orderBy,
    })) as CropListItem[]
  } catch {
    crops = (await prisma.crop.findMany({
      where: growingFallback,
      include,
      orderBy,
    })) as CropListItem[]
  }

  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">作物管理</h1>
            <p className="farms-subtitle">
              栽培中の作付け一覧です。収穫済み・完了は「過去の作付け」へ
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/crops/archive" className="btn btn-outline farms-add-button">
              過去の作付け
            </Link>
            <Link href="/crops/new" className="btn btn-primary farms-add-button">
              新規作物を追加
            </Link>
          </div>
        </div>

        {farms.length > 0 && (
          <div className="farms-filter-bar">
            <Link
              href="/crops"
              className={!farmId ? 'farms-filter-active' : 'farms-filter-link'}
            >
              すべて
            </Link>
            {farms.map((farm) => (
              <Link
                key={farm.id}
                href={`/crops?farmId=${farm.id}`}
                className={farmId === farm.id ? 'farms-filter-active' : 'farms-filter-link'}
              >
                {farm.name}
              </Link>
            ))}
          </div>
        )}

        {crops.length === 0 ? (
          <div className="card farms-empty-card">
            <div className="farms-empty-icon">🌱</div>
            <h3 className="farms-empty-title">栽培中の作物はありません</h3>
            <p className="farms-empty-text">
              新規登録するか、過去の作付け一覧を確認してください
            </p>
            <div className="insights-header-actions" style={{ justifyContent: 'center' }}>
              <Link href="/crops/new" className="btn btn-primary farms-add-button">
                新規作物を追加
              </Link>
              <Link href="/crops/archive" className="btn btn-outline farms-add-button">
                過去の作付け
              </Link>
            </div>
          </div>
        ) : (
          <div className="farms-grid">
            {crops.map((crop) => (
              <article key={crop.id} className="card farms-card">
                <h3 className="farms-card-title">
                  <Link href={`/crops/${crop.id}`} className="farms-card-title-link">
                    {crop.name}
                  </Link>
                </h3>

                {crop.variety && <p className="farms-card-desc">{crop.variety}</p>}

                <div className="farms-card-meta">
                  <span>🌾 {crop._count.harvests} 収穫</span>
                  <span>📋 {crop._count.tasks} タスク</span>
                  <span>📝 {crop._count.workRecords} 作業</span>
                </div>

                {(crop.farm || crop.field || crop.plantingDate || crop.harvestDate) && (
                  <div className="farms-card-location">
                    {crop.farm && (
                      <>
                        🏠{' '}
                        <Link href={`/farms/${crop.farm.id}`} className="farms-card-title-link">
                          {crop.farm.name}
                        </Link>
                      </>
                    )}
                    {crop.field && <> · 📍 {crop.field.name}</>}
                    {crop.plantingDate && (
                      <>
                        {' '}
                        · 🌱 {formatDateShort(crop.plantingDate)}
                        {daysSincePlanting(crop.plantingDate) != null
                          ? `（植付から${daysSincePlanting(crop.plantingDate)}日）`
                          : ''}
                      </>
                    )}
                    {crop.harvestDate && <> · 📅 {formatDateShort(crop.harvestDate)}</>}
                  </div>
                )}

                <div className="farms-card-actions">
                  <Link href={`/crops/${crop.id}`} className="btn btn-outline farms-card-button">
                    詳細
                  </Link>
                  <Link href={`/crops/${crop.id}/edit`} className="btn btn-secondary farms-card-button">
                    編集
                  </Link>
                  {crop.plantingDate && (
                    <Link
                      href={`/gdd?cropId=${crop.id}`}
                      className="btn btn-outline farms-card-button"
                    >
                      生育ナビ
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
