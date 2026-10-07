import { getCurrentUser } from '@/lib/auth'
import { getTodayProposals, type Proposal, type ProposalType } from '@/lib/ai-proposal'
import { recordHref, taskHref } from '@/lib/proposals/links'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import ProposalDismissButton from './ProposalDismissButton'
import ProposalSeasonActions from './ProposalSeasonActions'
import MilestoneAskActions from './MilestoneAskActions'
import { isFrostTrigger } from '@/lib/proposals/frost'
import { isMilestoneTrigger } from '@/lib/proposals/milestones'

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

function ProposalGroup({ title, items }: { title: string; items: Proposal[] }) {
  if (items.length === 0) return null
  return (
    <section className="ai-proposal-group">
      <h2 className="ai-proposal-group-title">
        {title}
        <span className="ai-proposal-group-count">{items.length}</span>
      </h2>
      <ul className="ai-proposal-list">
        {items.map((p) => (
          <li key={p.id}>
            <article className={`ai-proposal-card ${priorityBorderClass[p.priority]}`}>
              <div className="ai-proposal-card-inner">
                <span className="ai-proposal-card-icon">{typeIcon[p.type]}</span>
                <div className="ai-proposal-card-body">
                  <span className="ai-proposal-card-type">
                    {p.milestone ? '節目' : isFrostTrigger(p.trigger) ? '締切' : typeLabel[p.type]}
                  </span>
                  <h3 className="ai-proposal-card-title">{p.title}</h3>
                  {!(p.lines && p.lines.length > 1) && <ProposalMeta proposal={p} />}
                  {p.milestone && p.lines && p.lines.length > 1 && p.trigger ? (
                    <div className="ai-proposal-milestone">
                      <p className="ai-proposal-milestone-term">（{p.milestone.term}）</p>
                      <p className="ai-proposal-milestone-advice">{p.milestone.ifYes}</p>
                      {p.milestone.howTo.length > 0 && (
                        <ul className="ai-proposal-howto">
                          {p.milestone.howTo.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      )}
                      <p className="ai-proposal-milestone-source">出典: {p.milestone.sourceLabel}</p>
                      <ul className="ai-proposal-lines">
                        {p.lines.map((line) => (
                          <li key={line.cropId} className="ai-proposal-line">
                            <span>
                              {line.cropName}
                              {line.farmName ? ` · ${line.farmName}` : ''}
                              {line.daysSincePlanting != null ? ` · 植付から${line.daysSincePlanting}日` : ''}
                            </span>
                            <MilestoneAskActions
                              cropId={line.cropId}
                              milestoneKey={p.milestone!.key}
                              trigger={p.trigger!}
                              term={p.milestone!.term}
                              ifYes={p.milestone!.ifYes}
                              sourceLabel={p.milestone!.sourceLabel}
                              howTo={p.milestone!.howTo}
                              yesLabel={p.milestone!.yesLabel}
                              variant="row"
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : p.milestone && p.relatedCropId && p.trigger ? (
                    <MilestoneAskActions
                      cropId={p.relatedCropId}
                      milestoneKey={p.milestone.key}
                      trigger={p.trigger}
                      term={p.milestone.term}
                      ifYes={p.milestone.ifYes}
                      sourceLabel={p.milestone.sourceLabel}
                      howTo={p.milestone.howTo}
                      yesLabel={p.milestone.yesLabel}
                    />
                  ) : (
                    <ProposalLayersBlock layers={p.layers} />
                  )}
                  {p.milestone ? null : p.lines && p.lines.length > 1 && p.trigger !== 'soil-ph' ? (
                    <ul className="ai-proposal-lines">
                      {p.lines.map((line) => (
                        <li key={line.cropId} className="ai-proposal-line">
                          <span>
                            {line.cropName}
                            {line.variety ? `（${line.variety}）` : ''}
                            {line.farmName ? ` · ${line.farmName}` : ''}
                            {line.daysSincePlanting != null ? ` · 植付から${line.daysSincePlanting}日` : ''}
                            {line.currentGDD != null ? ` · ${line.currentGDD}/${line.targetGDD}℃日` : ''}
                          </span>
                          {p.trigger === 'season-finish' ? (
                            <ProposalSeasonActions cropId={line.cropId} farmId={line.farmId} trigger={p.trigger} />
                          ) : (
                            <span className="ai-proposal-line-actions">
                              <Link
                                href={recordHref({
                                  title: line.action?.title ?? p.title,
                                  relatedCropId: line.cropId,
                                  relatedFarmId: line.farmId,
                                  suggestedDate: p.suggestedDate,
                                  action: line.action,
                                })}
                                className="ai-proposal-action ai-proposal-action--primary"
                              >
                                記録する
                              </Link>
                              <Link
                                href={taskHref({
                                  title: line.action?.title ?? p.title,
                                  relatedCropId: line.cropId,
                                  relatedFarmId: line.farmId,
                                  suggestedDate: p.suggestedDate,
                                  action: line.action,
                                })}
                                className="ai-proposal-action"
                              >
                                タスクにする
                              </Link>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="ai-proposal-actions">
                      {p.trigger === 'season-finish' && p.relatedCropId ? (
                        <ProposalSeasonActions
                          cropId={p.relatedCropId}
                          farmId={p.relatedFarmId}
                          trigger={p.trigger}
                        />
                      ) : (
                        <>
                          {(p.relatedCropId || p.action?.taskType) && (
                            <Link href={recordHref(p)} className="ai-proposal-action ai-proposal-action--primary">
                              記録する
                            </Link>
                          )}
                          <Link href={taskHref(p)} className="ai-proposal-action">
                            タスクにする
                          </Link>
                        </>
                      )}
                    </div>
                  )}
                  {p.trigger && p.trigger !== 'season-finish' && !p.milestone && !isFrostTrigger(p.trigger) && (
                    <div className="ai-proposal-actions">
                      <ProposalDismissButton
                        trigger={p.trigger}
                        cropId={p.lines && p.lines.length > 1 ? undefined : p.relatedCropId}
                        cropIds={
                          p.lines && (p.lines.length > 1 || p.trigger === 'soil-ph')
                            ? p.lines.map((line) => line.cropId)
                            : undefined
                        }
                      />
                    </div>
                  )}
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
                      <Link href={`/gdd/${p.relatedCropId}`} className="ai-proposal-card-link">
                        生育ナビで見る →
                      </Link>
                    )}
                    {p.trigger === 'neglected-crop' && p.relatedCropId && (
                      <Link href={`/crops/${p.relatedCropId}/edit`} className="ai-proposal-card-link">
                        作付けの状態を変える →
                      </Link>
                    )}
                    <Link href="/insights" className="ai-proposal-card-link">
                      分析・振り返り →
                    </Link>
                    {(p.trigger === 'last-year-same-day' ||
                      p.layers.personal?.includes('昨年同日')) && (
                      <Link href="/calendar" className="ai-proposal-card-link">
                        カレンダーで昨年を見る →
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
    </section>
  )
}

function ProposalMeta({ proposal }: { proposal: Proposal }) {
  const parts = [
    proposal.relatedCropName,
    proposal.relatedFarmName,
    proposal.daysSincePlanting != null ? `植付から${proposal.daysSincePlanting}日` : null,
  ].filter((part): part is string => !!part)
  if (parts.length === 0) return null
  return <p className="ai-proposal-card-meta">{parts.join(' · ')}</p>
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
  const isConfirm = (trigger?: string) => trigger === 'season-finish' || isMilestoneTrigger(trigger)
  const confirmItems = proposals.filter((item) => isConfirm(item.trigger))
  const todayItems = proposals.filter((item) => item.urgency === 'today' && !isConfirm(item.trigger))
  const weekItems = proposals.filter((item) => item.urgency === 'thisWeek' && !isConfirm(item.trigger))
  const watchCount = proposals.filter((item) => item.urgency === 'watch').length
  const visible = todayItems.length + weekItems.length + confirmItems.length

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main">
        <div className="ai-proposal-wrap">
          <div className="farms-header ai-proposal-page-header">
            <div className="farms-header-text">
              <h1 className="ai-proposal-title" style={{ marginBottom: 0 }}>
                今日の提案
              </h1>
              <p className="ai-proposal-desc" style={{ marginBottom: 0 }}>
                【あなた】【地域】【一般】の根拠を重ねて、今日の一手を提案します。
              </p>
            </div>
            <div className="insights-header-actions">
              <Link href="/insights" className="btn btn-outline farms-add-button">
                分析・振り返り
              </Link>
              <Link href="/gdd" className="btn btn-outline farms-add-button">
                生育ナビ
              </Link>
            </div>
          </div>

          {visible === 0 && watchCount === 0 ? (
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
                <Link href="/insights" className="ai-proposal-btn-primary">
                  分析・振り返り
                </Link>
                <Link href="/gdd" className="ai-proposal-btn-primary">
                  生育ナビ
                </Link>
              </div>
            </div>
          ) : (
            <>
              <ProposalGroup title="今日やること" items={todayItems} />
              <ProposalGroup title="今週中に" items={weekItems} />
              <ProposalGroup title="確認したいこと" items={confirmItems} />
              {watchCount > 0 && (
                <p className="ai-proposal-watch">様子見 {watchCount}件（記録が止まっている作付け）</p>
              )}
            </>
          )}

          <nav className="ai-proposal-footer-nav" aria-label="関連ページ">
            <Link href="/dashboard" className="ai-proposal-back-link">
              ← ダッシュボード
            </Link>
            <Link href="/insights" className="ai-proposal-back-link">
              分析・振り返り →
            </Link>
            <Link href="/gdd" className="ai-proposal-back-link">
              生育ナビ →
            </Link>
            <Link href="/calendar" className="ai-proposal-back-link">
              カレンダー →
            </Link>
          </nav>
        </div>
      </main>
    </div>
  )
}
