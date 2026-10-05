import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import RecordDeleteButton from '@/components/RecordDeleteButton'
import { formatDateShort, formatDate } from '@/lib/utils'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { id } = await params

  const task = await prisma.task.findFirst({
    where: { id, farm: { userId: user.id } },
    include: {
      farm: true,
      crop: true,
    },
  })

  if (!task) notFound()

  const statusLabels: Record<string, string> = {
    pending: '未着手',
    in_progress: '進行中',
    completed: '完了',
  }
  const priorityLabels: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
  }
  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800',
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 px-6 py-8">
        <div className="mb-6">
          <Link href="/tasks" className="text-sm text-gray-500 hover:text-gray-700">
            ← タスク一覧
          </Link>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{task.title}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                task.status === 'completed' ? 'bg-green-100 text-green-800' :
                task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {statusLabels[task.status]}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[task.priority]}`}>
                優先度: {priorityLabels[task.priority]}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <RecordDeleteButton
              url={`/api/tasks/${task.id}`}
              confirmMessage="このタスクを削除しますか？"
              redirectTo="/tasks"
            />
            <Link href="/tasks" className="btn btn-outline">
              一覧に戻る
            </Link>
          </div>
        </div>

        {task.description && (
          <div className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-lg font-semibold mb-2">説明</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-lg font-semibold mb-4">詳細</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">農場</dt>
              <dd>
                <Link href={`/farms/${task.farm.id}`} className="text-green-600 hover:underline">
                  {task.farm.name}
                </Link>
              </dd>
            </div>
            {task.crop && (
              <div>
                <dt className="text-sm text-gray-500">関連作物</dt>
                <dd>
                  <Link href={`/crops/${task.crop.id}`} className="text-green-600 hover:underline">
                    {task.crop.name}
                  </Link>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-gray-500">期限</dt>
              <dd className="text-gray-900">
                {task.dueDate ? formatDate(task.dueDate) : '未設定'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">ステータス</dt>
              <dd className="text-gray-900">{statusLabels[task.status]}</dd>
            </div>
          </dl>
        </div>

        <p className="text-sm text-gray-500">
          ※ 編集・完了操作は今後の実装で追加予定です。
        </p>
      </main>
    </div>
  )
}
