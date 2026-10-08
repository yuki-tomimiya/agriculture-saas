import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getFertilizerWhere, getCropWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'
import { RecordTabs } from '@/components/RecordTabs'
import { WorkManagementTabs, buildWorkManagementQuery } from '@/components/WorkManagementTabs'

export default async function FertilizersPage({
  searchParams,
}: {
  searchParams: { cropId?: string; farmId?: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { where: cropWhere, whereFallback: cropWhereFallback } = getCropWhere(user.id)
  const cropsForFilter = await prisma.crop.findMany({
    where: cropWhere,
    orderBy: { name: 'asc' },
  }).catch(() =>
    prisma.crop.findMany({
      where: cropWhereFallback,
      orderBy: { name: 'asc' },
    })
  )
  const farmsForFilter = await prisma.farm.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  })

  const { where: fertilizerWhere } = getFertilizerWhere(user.id, {
    cropId: searchParams.cropId,
    farmId: searchParams.farmId,
  })
  type FertilizerRow = Prisma.FertilizerRecordGetPayload<{
    include: { crop: { include: { farm: true } }; farm: true }
  }>
  let records: FertilizerRow[] = []
  try {
    records = await prisma.fertilizerRecord.findMany({
      where: fertilizerWhere,
      include: {
        crop: { include: { farm: true } },
        farm: true,
      },
      orderBy: { appliedAt: 'desc' },
    })
  } catch {
    records = []
  }

  const filterQuery = buildWorkManagementQuery(searchParams)

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">作業管理</h1>
            <p className="farms-subtitle">肥料名・使用量・成分など、施肥の記録一覧</p>
            <RecordTabs active="work" />
            <WorkManagementTabs active="fertilizers" queryString={filterQuery} />
          </div>
          <Link href="/fertilizers/new" className="btn btn-primary farms-add-button">
            施肥記録を追加
          </Link>
        </div>

        {(cropsForFilter.length > 0 || farmsForFilter.length > 0) && (
          <div className="farms-filter-bar">
            <Link
              href="/fertilizers"
              className={!searchParams.cropId && !searchParams.farmId ? 'farms-filter-active' : 'farms-filter-link'}
            >
              すべて
            </Link>
            {cropsForFilter.map((crop) => (
              <Link
                key={crop.id}
                href={`/fertilizers?cropId=${crop.id}`}
                className={searchParams.cropId === crop.id ? 'farms-filter-active' : 'farms-filter-link'}
              >
                {crop.name}
              </Link>
            ))}
            {farmsForFilter.map((farm) => (
              <Link
                key={farm.id}
                href={`/fertilizers?farmId=${farm.id}`}
                className={searchParams.farmId === farm.id ? 'farms-filter-active' : 'farms-filter-link'}
              >
                {farm.name}
              </Link>
            ))}
          </div>
        )}

        {records.length === 0 ? (
          <div className="card farms-empty-card">
            <div className="farms-empty-icon">🧪</div>
            <h3 className="farms-empty-title">施肥記録がありません</h3>
            <p className="farms-empty-text">施肥記録を登録して成分・使用量を管理しましょう</p>
            <Link href="/fertilizers/new" className="btn btn-primary farms-add-button">
              施肥記録を追加
            </Link>
          </div>
        ) : (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">施肥日</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">肥料名</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">作物</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">農場</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">使用量</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">成分</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <Link href={`/fertilizers/${rec.id}`} className="farms-card-title-link">
                          {formatDateShort(rec.appliedAt)}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">{rec.productName}</td>
                      <td className="py-3 px-4">
                        {rec.crop ? (
                          <Link href={`/crops/${rec.crop.id}`} className="farms-card-title-link">
                            {rec.crop.name}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {rec.farm?.name ?? rec.crop?.farm?.name ?? '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {rec.amount} {rec.amountUnit}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">{rec.componentInfo ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
