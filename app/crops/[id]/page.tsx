import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { formatDateShort } from '@/lib/utils'

export default async function CropDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { id } = await params

  const include = {
    farm: true,
    field: true,
    harvests: { orderBy: { date: 'desc' as const }, take: 20 },
    tasks: { orderBy: { dueDate: 'asc' as const } },
  } as const

  let crop = await prisma.crop.findFirst({
    where: {
      id,
      OR: [
        { userId: user.id },
        { farm: { userId: user.id } },
      ],
    },
    include,
  }).catch(() => null)

  if (!crop) {
    crop = await prisma.crop.findFirst({
      where: { id, farm: { userId: user.id } },
      include,
    })
  }

  if (!crop) notFound()

  const statusLabel =
    crop.status === 'growing' ? '栽培中' : crop.status === 'harvested' ? '収穫済み' : '完了'

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 px-6 py-8">
        <div className="mb-6">
          <Link href="/crops" className="text-sm text-gray-500 hover:text-gray-700">
            ← 作物一覧
          </Link>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{crop.name}</h1>
            {crop.variety && (
              <p className="text-gray-600">品種: {crop.variety}</p>
            )}
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
              crop.status === 'growing' ? 'bg-green-100 text-green-800' :
              crop.status === 'harvested' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {statusLabel}
            </span>
          </div>
          <div className="flex gap-2">
            <Link href={`/crops/${id}/edit`} className="btn btn-primary">
              編集
            </Link>
            <Link href="/crops" className="btn btn-outline">
              一覧に戻る
            </Link>
          </div>
        </div>

        {/* 基本情報 */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">栽培情報</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {crop.farm && (
              <div>
                <dt className="text-sm text-gray-500">農場</dt>
                <dd>
                  <Link href={`/farms/${crop.farm.id}`} className="text-green-600 hover:underline">
                    {crop.farm.name}
                  </Link>
                </dd>
              </div>
            )}
            {crop.field && (
              <div>
                <dt className="text-sm text-gray-500">圃場</dt>
                <dd className="text-gray-900">{crop.field.name}</dd>
              </div>
            )}
            {crop.plantingDate && (
              <div>
                <dt className="text-sm text-gray-500">植え付け日</dt>
                <dd className="text-gray-900">{formatDateShort(crop.plantingDate)}</dd>
              </div>
            )}
            {crop.harvestDate && (
              <div>
                <dt className="text-sm text-gray-500">収穫予定日</dt>
                <dd className="text-gray-900">{formatDateShort(crop.harvestDate)}</dd>
              </div>
            )}
            {crop.baseTemperature != null && (
              <div>
                <dt className="text-sm text-gray-500">GDD基準温度</dt>
                <dd className="text-gray-900">{crop.baseTemperature} ℃</dd>
              </div>
            )}
          </dl>
        </div>

        {/* 収穫履歴 */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">収穫履歴</h2>
            <Link href="/harvests/new" className="text-sm text-green-600 hover:underline">
              収穫を記録 →
            </Link>
          </div>
          {crop.harvests.length === 0 ? (
            <p className="text-gray-500 py-4">収穫がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-semibold text-gray-700">日付</th>
                    <th className="text-right py-2 font-semibold text-gray-700">数量</th>
                    <th className="text-left py-2 font-semibold text-gray-700">メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {crop.harvests.map((h) => (
                    <tr key={h.id} className="border-b border-gray-100">
                      <td className="py-2">
                        <Link href={`/harvests/${h.id}`} className="text-green-600 hover:underline">
                          {formatDateShort(h.date)}
                        </Link>
                      </td>
                      <td className="py-2 text-right font-medium">{h.quantity} {h.unit}</td>
                      <td className="py-2 text-gray-600">{h.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 関連タスク */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">関連タスク</h2>
            <Link href="/tasks" className="text-sm text-green-600 hover:underline">
              タスク一覧 →
            </Link>
          </div>
          {crop.tasks.length === 0 ? (
            <p className="text-gray-500 py-4">この作物に紐づくタスクはありません</p>
          ) : (
            <ul className="space-y-2">
              {crop.tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded"
                  >
                    <span className="font-medium">{task.title}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      task.status === 'completed' ? 'bg-green-100 text-green-800' :
                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status === 'pending' ? '未着手' : task.status === 'in_progress' ? '進行中' : '完了'}
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
