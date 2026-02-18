import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'

export default async function HarvestsPage({
  searchParams,
}: {
  searchParams: { cropId?: string }
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const where = {
    crop: {
      farm: {
        userId: user.id,
      },
      ...(searchParams.cropId && { id: searchParams.cropId }),
    },
  }

  const harvests = await prisma.harvest.findMany({
    where,
    include: {
      crop: {
        include: {
          farm: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  })

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">収穫記録</h1>
          <p className="text-gray-600">収穫記録の一覧と管理</p>
        </div>
        <Link href="/harvests/new" className="btn btn-primary">
          新規収穫記録を追加
        </Link>
      </div>

      {harvests.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🌾</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            収穫記録がありません
          </h3>
          <p className="text-gray-600 mb-6">
            最初の収穫記録を登録しましょう
          </p>
          <Link href="/harvests/new" className="btn btn-primary">
            新規収穫記録を追加
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
                      <Link href={`/harvests/${harvest.id}`} className="text-gray-900 hover:text-primary-600">
                        {formatDateShort(harvest.date)}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/crops/${harvest.crop.id}`} className="font-medium text-gray-900 hover:text-primary-600">
                        {harvest.crop.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {harvest.crop.farm.name}
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
