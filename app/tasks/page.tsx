import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'

export default async function TasksPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const tasks = await prisma.task.findMany({
    where: { farm: { userId: user.id } },
    include: {
      farm: true,
      crop: true,
    },
    orderBy: [
      { status: 'asc' },
      { priority: 'desc' },
      { dueDate: 'asc' },
    ],
  })

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">タスク管理</h1>
          <p className="text-gray-600">タスクの一覧と管理</p>
        </div>
        <Link href="/tasks/new" className="btn btn-primary">
          新規タスクを追加
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            タスクが登録されていません
          </h3>
          <p className="text-gray-600 mb-6">
            最初のタスクを登録して、作業を管理しましょう
          </p>
          <Link href="/tasks/new" className="btn btn-primary">
            新規タスクを追加
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    タイトル
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    農場
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    作物
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    期限
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    優先度
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    ステータス
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Link href={`/tasks/${task.id}`} className="block">
                        <div className="font-medium text-gray-900 hover:text-primary-600">
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-sm text-gray-500 mt-1">
                            {task.description}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {task.farm.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {task.crop ? task.crop.name : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {task.dueDate ? formatDateShort(task.dueDate) : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[task.priority]}`}
                      >
                        {priorityLabels[task.priority]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          task.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {statusLabels[task.status]}
                      </span>
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
