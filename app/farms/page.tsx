import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default async function FarmsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: {
          crops: true,
          tasks: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">農場管理</h1>
          <p className="text-gray-600">農場の一覧と管理</p>
        </div>
        <button className="btn btn-primary">
          新規農場を追加
        </button>
      </div>

      {farms.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🌾</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            農場が登録されていません
          </h3>
          <p className="text-gray-600 mb-6">
            最初の農場を登録して、農業管理を始めましょう
          </p>
          <button className="btn btn-primary">
            新規農場を追加
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {farms.map((farm) => (
            <div key={farm.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <Link href={`/farms/${farm.id}`} className="text-xl font-semibold text-gray-900 hover:text-primary-600">
                  {farm.name}
                </Link>
              </div>

              {farm.description && (
                <p className="text-gray-600 mb-4 line-clamp-2">
                  {farm.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span>🌱 {farm._count.crops} 作物</span>
                <span>📋 {farm._count.tasks} タスク</span>
              </div>

              {farm.latitude && farm.longitude && (
                <div className="text-xs text-gray-500 mb-4">
                  📍 {farm.latitude.toFixed(4)}, {farm.longitude.toFixed(4)}
                </div>
              )}

              <div className="flex gap-2">
                <Link
                  href={`/farms/${farm.id}`}
                  className="btn btn-outline flex-1 text-sm text-center"
                >
                  詳細
                </Link>
                <Link
                  href={`/crops?farmId=${farm.id}`}
                  className="btn btn-secondary flex-1 text-sm text-center"
                >
                  作物を見る
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
