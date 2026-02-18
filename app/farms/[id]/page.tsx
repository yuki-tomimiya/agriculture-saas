import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { formatDateShort } from '@/lib/utils'

export default async function FarmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { id } = await params

  const farm = await prisma.farm.findFirst({
    where: { id, userId: user.id },
    include: {
      fields: true,
      _count: { select: { crops: true, tasks: true, workRecords: true } },
      crops: {
        include: { field: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      tasks: {
        where: { status: { not: 'completed' } },
        include: { crop: true },
        orderBy: { dueDate: 'asc' },
        take: 10,
      },
    },
  })

  if (!farm) notFound()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 px-6 py-8">
        <div className="mb-6">
          <Link href="/farms" className="text-sm text-gray-500 hover:text-gray-700">
            ← 農場一覧
          </Link>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{farm.name}</h1>
            {farm.description && (
              <p className="text-gray-600 max-w-2xl">{farm.description}</p>
            )}
          </div>
          <Link href="/farms" className="btn btn-outline">
            一覧に戻る
          </Link>
        </div>

        {/* 基本情報・サマリー */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm text-gray-600 mb-1">作物数</h3>
            <p className="text-2xl font-bold text-primary-600">{farm._count.crops}</p>
            <Link href={`/crops?farmId=${farm.id}`} className="text-sm text-primary-600 hover:underline mt-1 inline-block">
              作物一覧 →
            </Link>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm text-gray-600 mb-1">タスク数</h3>
            <p className="text-2xl font-bold text-orange-600">{farm._count.tasks}</p>
            <Link href={`/tasks`} className="text-sm text-primary-600 hover:underline mt-1 inline-block">
              タスク一覧 →
            </Link>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm text-gray-600 mb-1">位置情報</h3>
            {farm.latitude != null && farm.longitude != null ? (
              <p className="text-sm text-gray-700">
                {farm.latitude.toFixed(4)}, {farm.longitude.toFixed(4)}
              </p>
            ) : (
              <p className="text-sm text-gray-500">未設定</p>
            )}
          </div>
        </div>

        {/* 圃場一覧 */}
        {farm.fields.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold mb-4">圃場</h2>
            <ul className="space-y-2">
              {farm.fields.map((field) => (
                <li key={field.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="font-medium">{field.name}</span>
                  {field.area != null && (
                    <span className="text-sm text-gray-500">{field.area} m²</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* この農場の作物（直近） */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">この農場の作物</h2>
            <Link href={`/crops?farmId=${farm.id}`} className="text-sm text-primary-600 hover:underline">
              すべて見る →
            </Link>
          </div>
          {farm.crops.length === 0 ? (
            <p className="text-gray-500 py-4">作物が登録されていません</p>
          ) : (
            <ul className="space-y-2">
              {farm.crops.map((crop) => (
                <li key={crop.id}>
                  <Link
                    href={`/crops/${crop.id}`}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded"
                  >
                    <span className="font-medium">{crop.name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      crop.status === 'growing' ? 'bg-green-100 text-green-800' :
                      crop.status === 'harvested' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {crop.status === 'growing' ? '栽培中' : crop.status === 'harvested' ? '収穫済み' : '完了'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 未完了タスク（直近） */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">未完了タスク</h2>
            <Link href="/tasks" className="text-sm text-primary-600 hover:underline">
              すべて見る →
            </Link>
          </div>
          {farm.tasks.length === 0 ? (
            <p className="text-gray-500 py-4">未完了のタスクはありません</p>
          ) : (
            <ul className="space-y-2">
              {farm.tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded"
                  >
                    <span className="font-medium">{task.title}</span>
                    <span className="text-sm text-gray-500">
                      {task.dueDate ? formatDateShort(task.dueDate) : '期限なし'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
