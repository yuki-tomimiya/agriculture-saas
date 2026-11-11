import { getCurrentUser } from '@/lib/auth'
import type { Proposal, ProposalType } from '@/lib/ai-proposal'
import { recordHref, taskHref } from '@/lib/proposals/links'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WeatherDataSource from '@/components/WeatherDataSource'
import Sidebar from '@/components/Sidebar'
import ProposalDismissButton from './ProposalDismissButton'
import ProposalSeasonActions from './ProposalSeasonActions'
import MilestoneAskActions from './MilestoneAskActions'
import { isFrostTrigger } from '@/lib/proposals/frost'
import { loadProposalRecordGuidance, type ProposalRecordGuidance } from '@/lib/proposals/record-guidance'
import { FertilizerStandards, RecordGuidance } from '@/components/ProposalRecordGuidance'
import PestQuestion from './PestQuestion'
import { loadTodayProposalGroups } from '@/lib/proposals/presentation'

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

function ProposalGroup({ title, items, guidance }: { title: string; items: Proposal[]; guidance: Map<string, ProposalRecordGuidance> }) {
  if (items.length === 0) return null
  return (
    <section className="ai-proposal-group">
      <h2 className="ai-proposal-group-title">
        {title}
        <span className="ai-proposal-group-count">{items.length}</span>
      </h2>
      <ul className="ai-proposal-list">
        {items.map((p) => {
          const records = guidance.get(p.id)
          const milestone = p.trigger && (p.relatedCropId || (p.lines && p.lines.length > 1)) ? p.milestone : undefined
          return (
            <li key={p.id}>
              <article className={`ai-proposal-card ${priorityBorderClass[p.priority]}`}>
                <div className="ai-proposal-card-inner">
                  <span className="ai-proposal-card-icon">{typeIcon[p.type]}</span>
                  <div className="ai-proposal-card-body">
                    <div className="ai-proposal-card-action-column">
                      <span className="ai-proposal-card-type">
                        {p.milestone ? '節目' : isFrostTrigger(p.trigger) ? '締切' : typeLabel[p.type]}
                      </span>
                      <h3 className="ai-proposal-card-title">{p.title}</h3>
                      {!milestone && <p className="ai-proposal-conclusion">
                        <span className="insights-layer-tag insights-layer-tag--conclusion">今日の一手</span>
                        {p.layers.conclusion}
                      </p>}
                      {!(p.lines && p.lines.length > 1) && <>
                        <ProposalMeta proposal={p} />
                        {p.relatedCropId && <RecordGuidance entry={records?.byCrop.get(p.relatedCropId)} />}
                      </>}
                      {p.milestone && p.lines && p.lines.length > 1 && p.trigger ? (
                        <div className="ai-proposal-milestone">
                          <ul className="ai-proposal-lines">
                            {p.lines.map((line) => (
                              <li key={line.cropId} className="ai-proposal-line">
                                <span>
                                  {line.cropName}
                                  {line.farmName ? ` · ${line.farmName}` : ''}
                                  {line.daysSincePlanting != null ? ` · 植付から${line.daysSincePlanting}日` : ''}
                                  <RecordGuidance entry={records?.byCrop.get(line.cropId)} />
                                </span>
                                <MilestoneAskActions
                                  cropId={line.cropId}
                                  milestoneKey={p.milestone!.key}
                                  trigger={p.trigger!}
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
                          yesLabel={p.milestone.yesLabel}
                        />
                      ) : null}
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
                                {line.harvestOutlook && <span className="block">{line.harvestOutlook}</span>}
                                <RecordGuidance entry={records?.byCrop.get(line.cropId)} />
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
                        {p.trigger === 'conditions-missing' && (
                          <Link href="/crops" className="ai-proposal-card-link">
                            作物一覧 →
                          </Link>
                        )}
                        {p.trigger === 'result-missing' && (
                          <Link href="/crops/archive" className="ai-proposal-card-link">
                            過去の作付け →
                          </Link>
                        )}
                        {p.trigger === 'place-missing' && (
                          <Link href="/farms" className="ai-proposal-card-link">
                            農場一覧 →
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
                    {(milestone || p.layers.personal || p.layers.regional || p.layers.general || records?.standards.length) ? (
                      <div className="ai-proposal-evidence">
                        {milestone ? <MilestoneEvidence milestone={milestone} /> : <ProposalLayersBlock layers={p.layers} />}
                        <FertilizerStandards standards={records?.standards} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            </li>
          )
        })}
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

function MilestoneEvidence({ milestone }: { milestone: NonNullable<Proposal['milestone']> }) {
  return <div>
    <p className="ai-proposal-milestone-term">（{milestone.term}）</p>
    <p className="ai-proposal-milestone-advice">{milestone.ifYes}</p>
    {milestone.howTo.length > 0 && (
      <ul className="ai-proposal-howto">
        {milestone.howTo.map(line => <li key={line}>{line}</li>)}
      </ul>
    )}
    <p className="ai-proposal-milestone-source">出典: {milestone.sourceLabel}</p>
  </div>
}

function ProposalLayersBlock({ layers }: { layers: Proposal['layers'] }) {
  if (!layers.personal && !layers.regional && !layers.general) return null
  return (
    <div className="ai-proposal-layers">
      {layers.personal && (
        <p>
          <span className="insights-layer-tag">あなた</span>
          {layers.personal}
        </p>
      )}
      {layers.regional && (
        <>
        <p>
          <span className="insights-layer-tag">地域</span>
          {layers.regional}
        </p>
        <WeatherDataSource kind="mixed" />
        </>
      )}
      {layers.general && (
        <p>
          <span className="insights-layer-tag">一般</span>
          {layers.general}
        </p>
      )}
    </div>
  )
}

export default async function AiProposalPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { todayItems, weekItems, confirmItems, pestGroups, watchCount } = await loadTodayProposalGroups(user.id)
  const guidance = await loadProposalRecordGuidance(user.id, [...todayItems, ...weekItems, ...confirmItems])
  const visible = todayItems.length + weekItems.length + confirmItems.length + pestGroups.length

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

          <div className="mb-4">
            <Link href="/records/field" className="btn btn-primary">畑で見たことを記録する</Link>
          </div>

          {visible === 0 && watchCount === 0 ? (
            <div className="ai-proposal-empty">
              <p className="ai-proposal-empty-text">
                今表示する提案はありません。農場の場所や作付け（品目・植え付け日・育て方）に未登録の項目があれば、登録すると栽培の提案に使われます。
              </p>
              <div className="ai-proposal-empty-actions">
                <Link href="/tasks" className="ai-proposal-btn-primary">
                  タスクを確認
                </Link>
                <Link href="/farms" className="ai-proposal-btn-primary">
                  農場を確認
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
              <ProposalGroup title="今日やること" items={todayItems} guidance={guidance} />
              <ProposalGroup title="今週中に" items={weekItems} guidance={guidance} />
              <ProposalGroup title="確認したいこと" items={confirmItems} guidance={guidance} />
              {pestGroups.length > 0 && (
                <section className="ai-proposal-group">
                  <h2 className="ai-proposal-group-title">病害虫の見回り</h2>
                  <ul className="ai-proposal-list">
                    {pestGroups.map(group => <PestQuestion key={group[0].pest.key} questions={group} />)}
                  </ul>
                </section>
              )}
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
