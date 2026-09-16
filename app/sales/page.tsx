import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCropWhere, getSaleWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'

export default async function SalesPage({
  searchParams,
}: {
  searchParams: { cropId?: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { where } = getSaleWhere(user.id, { cropId: searchParams.cropId })

  let sales: any[] = []
  try {
    const saleModel = (prisma as { sale?: { findMany: (args: unknown) => Promise<any[]> } }).sale
    if (saleModel?.findMany) {
      sales = await saleModel.findMany({
        where,
        include: {
          crop: { include: { farm: true } },
          farm: true,
        },
        orderBy: { date: 'desc' },
      })
    } else {
      sales = []
    }
  } catch {
    sales = []
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
            <h1 className="farms-title">販売管理</h1>
            <p className="farms-subtitle">作物別・販売先別の販売実績の一覧と管理</p>
          </div>
          <div className="farms-header-actions">
            <Link href="/sales/new" className="btn btn-primary farms-add-button">
              売上を記録
            </Link>
          </div>
        </div>

        {sales.length > 0 && cropsForFilter.length > 0 && (
          <div className="farms-filter-bar">
            <Link
              href="/sales"
              className={!searchParams.cropId ? 'farms-filter-active' : 'farms-filter-link'}
            >
              すべて
            </Link>
            {cropsForFilter.map((crop) => (
              <Link
                key={crop.id}
                href={`/sales?cropId=${crop.id}`}
                className={searchParams.cropId === crop.id ? 'farms-filter-active' : 'farms-filter-link'}
              >
                {crop.name}
              </Link>
            ))}
          </div>
        )}

        {sales.length === 0 ? (
          <div className="card farms-empty-card">
            <div className="farms-empty-icon">💰</div>
            <h3 className="farms-empty-title">販売記録がありません</h3>
            <p className="farms-empty-text">最初の販売を記録してみましょう。</p>
            <Link href="/sales/new" className="btn btn-primary farms-add-button">
              売上を記録
            </Link>
          </div>
        ) : (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">日付</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">作物</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">販売先</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">数量</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">単価</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">販売金額</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">チャネル</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        {formatDateShort(sale.date)}
                      </td>
                      <td className="py-3 px-4">
                        {sale.crop ? (
                          <Link href={`/crops/${sale.crop.id}`} className="farms-card-title-link">
                            {sale.crop.name}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {sale.customerName}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {sale.quantity} {sale.unit}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {sale.unitPrice.toLocaleString()} 円
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {sale.amount.toLocaleString()} 円
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {sale.channel ?? '-'}
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

