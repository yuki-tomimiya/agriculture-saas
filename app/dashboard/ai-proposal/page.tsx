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

const priorityBorderClass: Record<Proposal['priority'], string> = {
  high: 'ai-proposal-card--high',
  medium: 'ai-proposal-card--medium',
  low: 'ai-proposal-card--low',
}

function ProposalLayersBlock({ layers }: { layers: Proposal['layers'] }) {
  return (
    <div className="ai-proposal-layers">
      {layers.personal && (
        <p>
          <span className="insights-layer-tag">あなた</span>
          {layers.personal}
        </p>
      )}
      {layers.regional && (
        <p>
          <span className="insights-layer-tag">地域</span>
          {layers.regional}
        </p>
      )}
      {layers.general && (
        <p>
          <span className="insights-layer-tag">一般</span>
          {layers.general}
        </p>
      )}
      <p className="ai-proposal-conclusion">
        <span className="insights-layer-tag insights-layer-tag--conclusion">今日の一手</span>
        {layers.conclusion}
      </p>
    </div>
  )
}

export default async function AiProposalPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const proposals = await getTodayProposals(user.id)

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main">
        <div className="ai-proposal-wrap">
          <h1 className="ai-proposal-title">今日の提案</h1>
          <p className="ai-proposal-desc">
            【あなた】【地域】【一般】の根拠を重ねて、今日の一手を提案します。
          </p>

          {proposals.length === 0 ? (
            <div className="ai-proposal-empty">
              <p className="ai-proposal-empty-text">
                今日の提案はありません。タスクの期限や作物の植え付け日を登録すると、ここに表示されます。
              </p>
              <div className="ai-proposal-empty-actions">
                <Link href="/tasks" className="ai-proposal-btn-primary">
                  タスクを確認
                </Link>
                <Link href="/crops" className="ai-proposal-btn-primary">
                  作物を確認
                </Link>
              </div>
            </div>
          ) : (
            <ul className="ai-proposal-list">
              {proposals.map((p) => (
                <li key={p.id}>
                  <article className={`ai-proposal-card ${priorityBorderClass[p.priority]}`}>
                    <div className="ai-proposal-card-inner">
                      <span className="ai-proposal-card-icon">{typeIcon[p.type]}</span>
                      <div className="ai-proposal-card-body">
                        <span className="ai-proposal-card-type">{typeLabel[p.type]}</span>
                        <h2 className="ai-proposal-card-title">{p.title}</h2>
                        <ProposalLayersBlock layers={p.layers} />
                        <div className="ai-proposal-card-links">
                          {p.relatedTaskId && (
                            <Link href="/tasks" className="ai-proposal-card-link">
                              タスクを見る →
                            </Link>
                          )}
                          {p.relatedCropId && (
                            <Link href={`/crops/${p.relatedCropId}`} className="ai-proposal-card-link">
                              作物を見る →
                            </Link>
                          )}
                          {p.relatedCropId && (
                            <Link href="/insights" className="ai-proposal-card-link">
                              分析・振り返り →
                            </Link>
                          )}
                          {p.type === 'weather' && (
                            <Link href="/weather" className="ai-proposal-card-link">
                              気象ナビ →
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

          <p className="ai-proposal-back">
            <Link href="/dashboard" className="ai-proposal-back-link">
              ← ダッシュボードに戻る
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
