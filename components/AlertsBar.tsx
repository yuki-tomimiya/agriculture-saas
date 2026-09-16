import Link from 'next/link'
import type { Proposal } from '@/lib/ai-proposal'

type Props = {
  proposals: Proposal[]
}

const priorityClass: Record<Proposal['priority'], string> = {
  high: 'alerts-item--high',
  medium: 'alerts-item--medium',
  low: 'alerts-item--low',
}

const typeLabel: Record<Proposal['type'], string> = {
  task_due: 'タスク',
  schedule: '生育・スケジュール',
  weather: '気象',
}

const typeIcon: Record<Proposal['type'], string> = {
  task_due: '⏰',
  schedule: '🌱',
  weather: '🌧️',
}

export default function AlertsBar({ proposals }: Props) {
  if (!proposals.length) return null

  return (
    <section className="alerts-bar" aria-label="今日の通知">
      <ul className="alerts-list">
        {proposals.map((p) => (
          <li key={p.id} className={`alerts-item ${priorityClass[p.priority]}`}>
            <div className="alerts-item-main">
              <span className="alerts-item-icon">{typeIcon[p.type]}</span>
              <div className="alerts-item-body">
                <div className="alerts-item-header">
                  <span className="alerts-item-type">{typeLabel[p.type]}</span>
                  {p.priority === 'high' && <span className="alerts-item-badge">重要</span>}
                </div>
                <p className="alerts-item-title">{p.title}</p>
                {p.layers ? (
                  <div className="ai-proposal-layers">
                    {p.layers.personal && (
                      <p className="alerts-item-desc">
                        <span className="insights-layer-tag">あなた</span>
                        {p.layers.personal}
                      </p>
                    )}
                    <p className="alerts-item-desc">
                      <span className="font-medium">{p.layers.conclusion}</span>
                    </p>
                  </div>
                ) : (
                  <p className="alerts-item-desc">{p.description}</p>
                )}
              </div>
            </div>
            <div className="alerts-item-links">
              {p.relatedTaskId && (
                <Link href="/tasks" className="alerts-item-link">
                  タスクを見る →
                </Link>
              )}
              {p.relatedCropId && (
                <Link href="/crops" className="alerts-item-link">
                  作物を見る →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

