import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getWorkRecordWhere, getCropWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'
import { WorkManagementTabs, buildWorkManagementQuery } from '@/components/WorkManagementTabs'

export default async function WorkRecordsPage({
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

  const { where: workRecordWhere } = getWorkRecordWhere(user.id, {
    cropId: searchParams.cropId,
    farmId: searchParams.farmId,
  })
  const records = await prisma.workRecord.findMany({
    where: workRecordWhere,
    include: {
      crop: true,
      farm: true,
      task: true,
    },
    orderBy: { date: 'desc' },
  })

  const filterQuery = buildWorkManagementQuery(searchParams)

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">作業管理</h1>
            <p className="farms-subtitle">植え付け・除草・整地など、実際に行った作業の記録</p>
            <WorkManagementTabs active="work-records" queryString={filterQuery} />
          </div>
          <Link href="/work-records/new" className="btn btn-primary farms-add-button">
            作業記録を追加
          </Link>
        </div>

        {(cropsForFilter.length > 0 || farmsForFilter.length > 0) && (
          <div className="farms-filter-bar">
            <Link
              href="/work-records"
              className={!searchParams.cropId && !searchParams.farmId ? 'farms-filter-active' : 'farms-filter-link'}
            >
              すべて
            </Link>
            {cropsForFilter.map((crop) => (
              <Link
                key={crop.id}
                href={`/work-records?cropId=${crop.id}`}
                className={searchParams.cropId === crop.id ? 'farms-filter-active' : 'farms-filter-link'}
              >
                {crop.name}
              </Link>
            ))}
            {farmsForFilter.map((farm) => (
              <Link
                key={farm.id}
                href={`/work-records?farmId=${farm.id}`}
                className={searchParams.farmId === farm.id ? 'farms-filter-active' : 'farms-filter-link'}
              >
                {farm.name}
              </Link>
            ))}
          </div>
        )}

        {records.length === 0 ? (
          <div className="card farms-empty-card">
            <div className="farms-empty-icon">📝</div>
            <h3 className="farms-empty-title">作業記録がありません</h3>
            <p className="farms-empty-text">
              実際に行った作業を記録して、カレンダーや栽培管理に活かしましょう
            </p>
            <Link href="/work-records/new" className="btn btn-primary farms-add-button">
              作業記録を追加
            </Link>
          </div>
        ) : (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">作業日</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">作業種別</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">内容</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">農場</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">作物</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <Link href={`/work-records/${rec.id}`} className="farms-card-title-link">
                          {formatDateShort(rec.date)}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {rec.taskType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {rec.description || rec.notes || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/farms/${rec.farm.id}`} className="farms-card-title-link">
                          {rec.farm.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {rec.crop ? (
                          <Link href={`/crops/${rec.crop.id}`} className="farms-card-title-link">
                            {rec.crop.name}
                          </Link>
                        ) : (
                          '-'
                        )}
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
