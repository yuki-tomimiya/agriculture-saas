import { getCurrentUser } from '@/lib/auth'
import { getTodayProposals, type Proposal, type ProposalType } from '@/lib/ai-proposal'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

const typeLabel: Record<ProposalType, string> = {
  task_due: 'タスク',
  schedule: '栽培スケジュール',
  weather: '気象',
}

const typeIcon: Record<ProposalType, string> = {
  task_due: '📋',
  schedule: '🌾',
  weather: '🌤',
}

const priorityBorder: Record<Proposal['priority'], string> = {
  high: 'border-l-orange-500',
  medium: 'border-l-violet-500',
  low: 'border-l-gray-400',
}

export default async function AiProposalPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const proposals = await getTodayProposals(user.id)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 px-6 py-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold mb-2">今日の提案</h1>
          <p className="text-gray-600 mb-8">
            気象・GDD・タスク・栽培スケジュールをもとに、今日やるといい作業を提案しています。
          </p>

          {proposals.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow p-8 text-center">
              <p className="text-gray-600 mb-4">
                今日の提案はありません。タスクの期限や作物の植え付け日を登録すると、ここに表示されます。
              </p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/tasks"
                  className="inline-flex items-center justify-center bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 text-sm font-medium"
                >
                  タスクを確認
                </Link>
                <Link
                  href="/crops"
                  className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  作物を確認
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {proposals.map((p) => (
                <li key={p.id}>
                  <article
                    className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden border-l-4 ${priorityBorder[p.priority]}`}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{typeIcon[p.type]}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {typeLabel[p.type]}
                          </span>
                          <h2 className="text-lg font-semibold text-gray-900 mt-0.5">
                            {p.title}
                          </h2>
                          <p className="text-gray-600 text-sm mt-1">{p.description}</p>
                          {p.relatedTaskId && (
                            <Link
                              href={`/tasks`}
                              className="inline-block mt-3 text-sm font-medium text-violet-600 hover:text-violet-700"
                            >
                              タスクを見る →
                            </Link>
                          )}
                          {p.relatedCropId && (
                            <Link
                              href={`/crops`}
                              className="inline-block mt-3 text-sm font-medium text-violet-600 hover:text-violet-700"
                            >
                              作物を見る →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}

          <p className="text-sm text-gray-500 mt-8">
            <Link href="/dashboard" className="text-violet-600 hover:underline">
              ← ダッシュボードに戻る
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
