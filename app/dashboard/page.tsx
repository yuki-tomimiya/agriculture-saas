import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import WeatherNav from '@/components/WeatherNav'
import WeatherForecast from '@/components/WeatherForecast'
import WorkCalendar from '@/components/WorkCalendar'
import GDDChart from '@/components/GDDChart'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  // 統計データを取得
  const [farms, crops, tasks, harvests] = await Promise.all([
    prisma.farm.count({ where: { userId: user.id } }),
    prisma.crop.count({ where: { farm: { userId: user.id } } }),
    prisma.task.count({ where: { farm: { userId: user.id } } }),
    prisma.harvest.count({ where: { crop: { farm: { userId: user.id } } } }),
  ])

  // 最近の作物
  const recentCrops = await prisma.crop.findMany({
    where: { farm: { userId: user.id } },
    include: { farm: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  // 最近の収穫記録
  const recentHarvests = await prisma.harvest.findMany({
    where: { crop: { farm: { userId: user.id } } },
    include: { crop: { include: { farm: true } } },
    orderBy: { date: 'desc' },
    take: 5,
  })

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 px-6 py-8">
        <h1 className="text-3xl font-bold mb-6">ダッシュボード</h1>

        {/* 上部サマリー（各カードから一覧ページへ） */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          <Link href="/farms" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow block">
            <h3 className="text-sm text-gray-600 mb-2">農場数</h3>
            <p className="text-3xl font-bold text-green-600">{farms}</p>
            <span className="text-xs text-gray-500 mt-2 inline-block">一覧を見る →</span>
          </Link>
          <Link href="/crops" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow block">
            <h3 className="text-sm text-gray-600 mb-2">作物数</h3>
            <p className="text-3xl font-bold text-blue-600">{crops}</p>
            <span className="text-xs text-gray-500 mt-2 inline-block">一覧を見る →</span>
          </Link>
          <Link href="/tasks" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow block">
            <h3 className="text-sm text-gray-600 mb-2">未完了タスク</h3>
            <p className="text-3xl font-bold text-orange-600">{tasks}</p>
            <span className="text-xs text-gray-500 mt-2 inline-block">一覧を見る →</span>
          </Link>
          <Link href="/harvests" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow block">
            <h3 className="text-sm text-gray-600 mb-2">最近の収穫</h3>
            <p className="text-3xl font-bold text-purple-600">{harvests}</p>
            <span className="text-xs text-gray-500 mt-2 inline-block">一覧を見る →</span>
          </Link>
        </div>

            {/* 中段：最近の作物 / 収穫 */}
            <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">最近の作物</h2>
              <Link href="/crops" className="text-sm text-primary-600 hover:underline">一覧を見る →</Link>
            </div>
            {recentCrops.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">作物が登録されていません</p>
                <Link href="/crops" className="btn btn-primary">
                  作物を追加
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {recentCrops.map((crop) => (
                  <li key={crop.id} className="border-b pb-2 last:border-0">
                    <Link href={`/crops/${crop.id}`} className="block py-1 hover:bg-gray-50 -mx-2 px-2 rounded">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">{crop.name}</span>
                        <span className="text-sm text-gray-500">{crop.farm.name}</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {crop.status === 'growing'
                          ? '成長中'
                          : crop.status === 'harvested'
                          ? '収穫済み'
                          : '完了'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">最近の収穫</h2>
              <Link href="/harvests" className="text-sm text-primary-600 hover:underline">一覧を見る →</Link>
            </div>
            {recentHarvests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">収穫記録がありません</p>
                <Link href="/harvests/new" className="btn btn-primary">
                  収穫記録を追加
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {recentHarvests.map((harvest) => (
                  <li key={harvest.id} className="border-b pb-2 last:border-0">
                    <Link href={`/harvests/${harvest.id}`} className="block py-1 hover:bg-gray-50 -mx-2 px-2 rounded">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">{harvest.crop.name}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(harvest.date).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {harvest.quantity} {harvest.unit}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 今週の気象ナビ */}
        <WeatherNav />

        {/* 下段：気象データ × 作業スケジュール提案 */}
        <div className="grid grid-cols-3 gap-6">
          {/* 左：気象予報（今後2週間：1日ごと） */}
          <WeatherForecast />

          {/* 中央：一般的なカレンダー形式の作業スケジュール */}
          <WorkCalendar />

          {/* 右：積算温度に基づく生育ナビ */}
          <GDDChart />
        </div>
      </main>
    </div>
  )
}
