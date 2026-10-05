import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPesticideWhere, getCropWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'
import { RecordTabs } from '@/components/RecordTabs'

export default async function PesticidesPage({
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

  const { where: pesticideWhere } = getPesticideWhere(user.id, {
    cropId: searchParams.cropId,
    farmId: searchParams.farmId,
  })
  const records = await (async () => {
    try {
      const model = (prisma as { pesticideRecord?: { findMany: (args: unknown) => Promise<unknown[]> } }).pesticideRecord
      if (!model?.findMany) return []
      return (await model.findMany({
        where: pesticideWhere,
        include: {
          crop: { include: { farm: true } },
          farm: true,
        },
        orderBy: { appliedAt: 'desc' },
      })) as Awaited<ReturnType<typeof prisma.pesticideRecord.findMany>>
    } catch {
      return []
    }
  })()

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">農薬管理</h1>
            <p className="farms-subtitle">農薬の散布記録一覧</p>
            <RecordTabs active="pesticides" />
          </div>
          <Link href="/pesticides/new" className="btn btn-primary farms-add-button">
            散布記録を追加
          </Link>
        </div>

        {(cropsForFilter.length > 0 || farmsForFilter.length > 0) && (
          <div className="farms-filter-bar">
            <Link
              href="/pesticides"
              className={!searchParams.cropId && !searchParams.farmId ? 'farms-filter-active' : 'farms-filter-link'}
            >
              すべて
            </Link>
            {cropsForFilter.map((crop) => (
              <Link
                key={crop.id}
                href={`/pesticides?cropId=${crop.id}`}
                className={searchParams.cropId === crop.id ? 'farms-filter-active' : 'farms-filter-link'}
              >
                {crop.name}
              </Link>
            ))}
            {farmsForFilter.map((farm) => (
              <Link
                key={farm.id}
                href={`/pesticides?farmId=${farm.id}`}
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
            <h3 className="farms-empty-title">農薬記録がありません</h3>
            <p className="farms-empty-text">散布記録を登録して適正使用を管理しましょう</p>
            <Link href="/pesticides/new" className="btn btn-primary farms-add-button">
              散布記録を追加
            </Link>
          </div>
        ) : (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">散布日</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">農薬名</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">作物</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">農場</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">使用量</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">希釈・収穫前日数</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <Link href={`/pesticides/${rec.id}`} className="farms-card-title-link">
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
                        {rec.amount != null ? `${rec.amount} ${rec.amountUnit ?? ''}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {[rec.dilution, rec.daysBeforeHarvest != null ? `収穫${rec.daysBeforeHarvest}日前` : null]
                          .filter(Boolean)
                          .join(' · ') || '-'}
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
