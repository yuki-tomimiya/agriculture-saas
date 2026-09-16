import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'

export default async function CropsPage({
  searchParams,
}: {
  searchParams: { farmId?: string }
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

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
  const orderBy = { createdAt: 'desc' as const }

  const { where, whereFallback } = getCropWhere(user.id, { farmId: searchParams.farmId })

  let crops: Awaited<ReturnType<typeof prisma.crop.findMany>>
  try {
    crops = await prisma.crop.findMany({ where, include, orderBy })
  } catch {
    crops = await prisma.crop.findMany({ where: whereFallback, include, orderBy })
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
            <p className="farms-subtitle">作物の一覧と管理</p>
          </div>
          <Link href="/crops/new" className="btn btn-primary farms-add-button">
            新規作物を追加
          </Link>
        </div>

        {crops.length > 0 && farms.length > 0 && (
          <div className="farms-filter-bar">
            <Link
              href="/crops"
              className={!searchParams.farmId ? 'farms-filter-active' : 'farms-filter-link'}
            >
              すべて
            </Link>
            {farms.map((farm) => (
              <Link
                key={farm.id}
                href={`/crops?farmId=${farm.id}`}
                className={searchParams.farmId === farm.id ? 'farms-filter-active' : 'farms-filter-link'}
              >
                {farm.name}
              </Link>
            ))}
          </div>
        )}

        {crops.length === 0 ? (
          <div className="card farms-empty-card">
            <div className="farms-empty-icon">🌱</div>
            <h3 className="farms-empty-title">作物が登録されていません</h3>
            <p className="farms-empty-text">
              最初の作物を登録して、成長を追跡しましょう
            </p>
            <Link href="/crops/new" className="btn btn-primary farms-add-button">
              新規作物を追加
            </Link>
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

                {crop.variety && (
                  <p className="farms-card-desc">
                    {crop.variety}
                  </p>
                )}

                <div className="farms-card-meta">
                  <span>🌾 {crop._count.harvests} 収穫</span>
                  <span>📋 {crop._count.tasks} タスク</span>
                  <span>📝 {crop._count.workRecords} 作業</span>
                </div>

                {(crop.farm || crop.field || crop.plantingDate || crop.harvestDate) && (
                  <div className="farms-card-location">
                    {crop.farm && (
                      <>🏠 <Link href={`/farms/${crop.farm.id}`} className="farms-card-title-link">{crop.farm.name}</Link></>
                    )}
                    {crop.field && <> · 📍 {crop.field.name}</>}
                    {crop.plantingDate && <> · 🌱 {formatDateShort(crop.plantingDate)}</>}
                    {crop.harvestDate && <> · 📅 {formatDateShort(crop.harvestDate)}</>}
                  </div>
                )}

                <div className="farms-card-actions">
                  <Link
                    href={`/crops/${crop.id}`}
                    className="btn btn-outline farms-card-button"
                  >
                    詳細
                  </Link>
                  <Link
                    href={`/crops/${crop.id}/edit`}
                    className="btn btn-secondary farms-card-button"
                  >
                    編集
                  </Link>
                  {crop.farm && (
                    <Link
                      href={`/farms/${crop.farm.id}`}
                      className="btn btn-outline farms-card-button"
                    >
                      農場
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
