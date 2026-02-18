import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

  const where = {
    farm: {
      userId: user.id,
      ...(searchParams.farmId && { id: searchParams.farmId }),
    },
  }

  const crops = await prisma.crop.findMany({
    where,
    include: {
      farm: true,
      field: true,
      _count: {
        select: {
          harvests: true,
          tasks: true,
          workRecords: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">作物管理</h1>
          <p className="text-gray-600">作物の一覧と管理</p>
        </div>
        <button className="btn btn-primary">
          新規作物を追加
        </button>
      </div>

      {/* フィルター */}
      {farms.length > 0 && (
        <div className="mb-6 flex gap-2">
          <Link
            href="/crops"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !searchParams.farmId
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            すべて
          </Link>
          {farms.map((farm) => (
            <Link
              key={farm.id}
              href={`/crops?farmId=${farm.id}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchParams.farmId === farm.id
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {farm.name}
            </Link>
          ))}
        </div>
      )}

      {crops.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🌱</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            作物が登録されていません
          </h3>
          <p className="text-gray-600 mb-6">
            最初の作物を登録して、成長を追跡しましょう
          </p>
          <button className="btn btn-primary">
            新規作物を追加
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {crops.map((crop) => (
            <div key={crop.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {crop.name}
                  </h3>
                  {crop.variety && (
                    <p className="text-sm text-gray-500">{crop.variety}</p>
                  )}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    crop.status === 'growing'
                      ? 'bg-green-100 text-green-800'
                      : crop.status === 'harvested'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {crop.status === 'growing'
                    ? '栽培中'
                    : crop.status === 'harvested'
                    ? '収穫済み'
                    : '完了'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p>🏠 {crop.farm.name}</p>
                {crop.field && <p>📍 {crop.field.name}</p>}
                {crop.plantingDate && (
                  <p>🌱 植え付け: {formatDateShort(crop.plantingDate)}</p>
                )}
                {crop.harvestDate && (
                  <p>📅 収穫予定: {formatDateShort(crop.harvestDate)}</p>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4 pb-4 border-b border-gray-200">
                <span>🌾 {crop._count.harvests} 収穫</span>
                <span>📋 {crop._count.tasks} タスク</span>
                <span>📝 {crop._count.workRecords} 作業</span>
              </div>

              <div className="flex gap-2">
                <button className="btn btn-outline flex-1 text-sm">
                  編集
                </button>
                <Link
                  href={`/crops/${crop.id}`}
                  className="btn btn-secondary flex-1 text-sm text-center"
                >
                  詳細
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      </main>
    </div>
  )
}
