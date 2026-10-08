import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCropWhere, getHarvestWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'
import { RecordTabs } from '@/components/RecordTabs'

export default async function HarvestsPage({
  searchParams,
}: {
  searchParams: { cropId?: string }
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const include = {
    crop: {
      include: { farm: true },
    },
  } as const

  const { where, whereFallback } = getHarvestWhere(user.id, { cropId: searchParams.cropId })

  let harvests
  try {
    harvests = await prisma.harvest.findMany({
      where,
      include,
      orderBy: { date: 'desc' },
    })
  } catch {
    harvests = await prisma.harvest.findMany({
      where: whereFallback,
      include,
      orderBy: { date: 'desc' },
    })
  }

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

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">収穫管理</h1>
            <p className="farms-subtitle">収穫量の一覧と管理</p>
            <RecordTabs active="harvests" />
          </div>
          <Link href="/harvests/new" className="btn btn-primary farms-add-button">
            収穫を記録
          </Link>
        </div>

        {harvests.length > 0 && cropsForFilter.length > 0 && (
          <div className="farms-filter-bar">
            <Link
              href="/harvests"
              className={!searchParams.cropId ? 'farms-filter-active' : 'farms-filter-link'}
            >
              すべて
            </Link>
            {cropsForFilter.map((crop) => (
              <Link
                key={crop.id}
                href={`/harvests?cropId=${crop.id}`}
                className={searchParams.cropId === crop.id ? 'farms-filter-active' : 'farms-filter-link'}
              >
                {crop.name}
              </Link>
            ))}
          </div>
        )}

        {harvests.length === 0 ? (
          <div className="card farms-empty-card">
            <div className="farms-empty-icon">🌾</div>
            <h3 className="farms-empty-title">収穫がありません</h3>
            <p className="farms-empty-text">
              最初の収穫を記録しましょう
            </p>
            <Link href="/harvests/new" className="btn btn-primary farms-add-button">
              収穫を記録
            </Link>
          </div>
        ) : (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      日付
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      作物
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      農場
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">
                      収穫量
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      メモ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {harvests.map((harvest) => (
                    <tr
                      key={harvest.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link href={`/harvests/${harvest.id}`} className="farms-card-title-link">
                          {formatDateShort(harvest.date)}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/crops/${harvest.crop.id}`} className="farms-card-title-link">
                          {harvest.crop.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {harvest.crop.farm?.name ?? '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-gray-900">
                          {harvest.quantity} {harvest.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {harvest.notes || '-'}
                      </td>
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
