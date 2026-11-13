import { getCurrentUser } from '@/lib/auth'
import type { Proposal } from '@/lib/ai-proposal'
import { recordHref, taskHref } from '@/lib/proposals/links'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WeatherDataSource, { JmaDataSource } from '@/components/WeatherDataSource'
import Sidebar from '@/components/Sidebar'
import ProposalDismissButton from './ProposalDismissButton'
import ProposalSeasonActions from './ProposalSeasonActions'
import MilestoneAskActions from './MilestoneAskActions'
import { isFrostTrigger } from '@/lib/proposals/frost'
import { JMA_SEARCH_TOP } from '@/lib/jma/thresholds'
import { loadProposalRecordGuidance, type ProposalRecordGuidance } from '@/lib/proposals/record-guidance'
import { FertilizerStandards, RecordGuidance } from '@/components/ProposalRecordGuidance'
import PestQuestion from './PestQuestion'
import QuestionLink from './QuestionLink'
import { loadTodayConfirmations, type CropConfirmation } from '@/lib/proposals/presentation'
import type { ConfirmationStage, NoConfirmationReason } from '@/lib/proposals/scoring'
import { pestTrigger } from '@/lib/pests/catalog'

const stageLabel: Record<ConfirmationStage, string> = {
  deadline: '締切', season: '例年の時期', reached: '目安に到達', window: '見て確かめる時期',
}

const missingLabels: Record<NoConfirmationReason, string> = {
  'no-location': '位置が未登録',
  'no-weather': '必要な天気データがありません',
  'record-only': '記録だけの品目',
  'no-question': '今は聞くことがありません',
}

const organizationLinks: Record<string, { href: string; label: string }> = {
  'conditions-missing': { href: '/crops', label: '作物一覧' },
  'result-missing': { href: '/crops/archive', label: '過去の作付け' },
  'place-missing': { href: '/farms', label: '農場一覧' },
}

type Guidance = Map<string, ProposalRecordGuidance>
type Confirmation = CropConfirmation['selected']

function questionId(trigger: string) {
  return 'question-' + trigger.replaceAll(':', '-')
}

function proposalQuestionHref(item: Confirmation) {
  return item.kind === 'pest' || item.proposal.milestone ? questionId(item.trigger) : null
}

function confirmationTitle(item: Confirmation) {
  return item.kind === 'proposal' ? item.proposal.title : item.question.pest.question
}

function ProposalActions({ proposal }: { proposal: Proposal }) {
  const { action, trigger, relatedCropId, relatedFarmId, relatedTaskId, lines } = proposal
  if (relatedTaskId) {
    return <div className="ai-proposal-actions">
      <Link href={`/tasks/${relatedTaskId}`} className="ai-proposal-action ai-proposal-action--primary">タスクを見る</Link>
    </div>
  }
  if (trigger === 'season-finish' && relatedCropId) {
    return <ProposalSeasonActions cropId={relatedCropId} farmId={relatedFarmId} trigger={trigger} />
  }
  const organizationLink = trigger ? organizationLinks[trigger] : undefined
  return <div className="ai-proposal-actions">
    {organizationLink && <Link href={organizationLink.href} className="ai-proposal-action">{organizationLink.label}</Link>}
    {(action?.taskType || action?.kind === 'sale' || (relatedCropId && action?.kind === 'work')) && (
      <Link href={recordHref(proposal)} className="ai-proposal-action ai-proposal-action--primary">記録する</Link>
    )}
    {action && <Link href={taskHref(proposal)} className="ai-proposal-action">タスクにする</Link>}
    {trigger === 'neglected-crop' && relatedCropId && (
      <Link href={`/crops/${relatedCropId}/edit`} className="ai-proposal-action">作付けの状態を変える</Link>
    )}
    {trigger && !isFrostTrigger(trigger) && (
      <ProposalDismissButton trigger={trigger} cropId={relatedCropId} cropIds={lines?.map(line => line.cropId)} />
    )}
  </div>
}

function ProposalEvidence({ proposal, records }: { proposal: Proposal; records?: ProposalRecordGuidance }) {
  const { personal, regional, general } = proposal.layers
  return <>
    <div className="ai-proposal-layers">
      {personal && <p><span className="insights-layer-tag">あなた</span>{personal}</p>}
      {regional && <p><span className="insights-layer-tag">地域</span>{regional}</p>}
      {general && <p><span className="insights-layer-tag">一般</span>{general}</p>}
    </div>
    {proposal.signal?.sources?.length ? (
      <ul className="morning-source-list">
        {proposal.signal.sources.map(source => <li key={source.url}><a href={source.url} className="underline">{source.label}</a></li>)}
      </ul>
    ) : null}
    {general?.includes(JMA_SEARCH_TOP) && <JmaDataSource />}
    {proposal.signal?.weatherSource && <WeatherDataSource kind={proposal.signal.weatherSource} />}
    <FertilizerStandards standards={records?.standards} />
  </>
}

function ProposalDetail({ proposal, guidance }: { proposal: Proposal; guidance: Guidance }) {
  const records = guidance.get(proposal.id)
  return <div className="ai-proposal-card-body">
    <div className="ai-proposal-card-action-column">
      <p>{proposal.layers.conclusion}</p>
      <RecordGuidance entry={proposal.relatedCropId ? records?.byCrop.get(proposal.relatedCropId) : undefined} />
      {proposal.lines && (
        <ul className="ai-proposal-lines">
          {proposal.lines.map(line => <li key={line.cropId} className="ai-proposal-line">
            <Link href={`/crops/${line.cropId}`} className="ai-proposal-card-link">{line.cropName}</Link>
            <RecordGuidance entry={records?.byCrop.get(line.cropId)} />
          </li>)}
        </ul>
      )}
      <ProposalActions proposal={proposal} />
      <div className="ai-proposal-card-links">
        {proposal.relatedCropId && <Link href={`/crops/${proposal.relatedCropId}`} className="ai-proposal-card-link">作付けを見る →</Link>}
        {proposal.relatedCropId && <Link href={`/gdd/${proposal.relatedCropId}`} className="ai-proposal-card-link">生育ナビで見る →</Link>}
        {(proposal.trigger === 'last-year-same-day' || proposal.layers.personal?.includes('昨年同日')) && (
          <Link href="/calendar" className="ai-proposal-card-link">カレンダーで昨年を見る →</Link>
        )}
        {proposal.type === 'weather' && <Link href="/weather" className="ai-proposal-card-link">気象ナビ →</Link>}
      </div>
    </div>
    <div className="ai-proposal-evidence"><ProposalEvidence proposal={proposal} records={records} /></div>
  </div>
}

function MilestoneEvidence({ milestone, standards }: {
  milestone: NonNullable<Proposal['milestone']>
  standards?: ProposalRecordGuidance['standards']
}) {
  return <>
    <p className="ai-proposal-milestone-term">（{milestone.term}）</p>
    <p className="ai-proposal-milestone-advice">{milestone.ifYes}</p>
    {milestone.howTo.length > 0 && <ul className="ai-proposal-howto">
      {milestone.howTo.map(line => <li key={line}>{line}</li>)}
    </ul>}
    <p className="mt-2 text-sm">{milestone.windowNote}</p>
    <p className="ai-proposal-milestone-source">出典　{milestone.sourceLabel}</p>
    <Link href="/faq/stages" className="ai-proposal-card-link">節目の出典資料を見る →</Link>
    <FertilizerStandards standards={standards} />
  </>
}

function ConfirmationDetail({ item, guidance }: { item: Confirmation; guidance: Guidance }) {
  if (item.kind === 'pest') {
    const { pest, timingSource } = item.question
    return <>
      <p>{pest.marker} {pest.appearance && <a className="underline" href={pest.appearance.url}>見た目の資料</a>}</p>
      {timingSource && <a className="underline" href={timingSource}>時期の出典</a>}
      <QuestionLink id={questionId(item.trigger)} />
    </>
  }
  const { proposal } = item
  if (proposal.milestone) {
    const records = guidance.get(proposal.id)
    return <>
      <MilestoneEvidence milestone={proposal.milestone} standards={records?.standards} />
      {proposal.signal?.weatherSource && <WeatherDataSource kind={proposal.signal.weatherSource} />}
      <RecordGuidance entry={proposal.relatedCropId ? records?.byCrop.get(proposal.relatedCropId) : undefined} />
      <QuestionLink id={questionId(item.trigger)} />
    </>
  }
  return <ProposalDetail proposal={proposal} guidance={guidance} />
}

function OtherChecks({ items, guidance }: { items: Confirmation[]; guidance: Guidance }) {
  if (!items.length) return null
  return <div className="morning-other">
    <p className="font-semibold">ほかに確かめること</p>
    <ul>
      {items.map(item => <li key={item.trigger}>
        <details className="morning-disclosure">
          <summary>{confirmationTitle(item)}</summary>
          <p className="morning-reason">{item.reason}</p>
          <ConfirmationDetail item={item} guidance={guidance} />
        </details>
      </li>)}
    </ul>
  </div>
}

function CropCheck({ row, guidance }: { row: CropConfirmation; guidance: Guidance }) {
  const id = proposalQuestionHref(row.selected)
  const records = row.selected.kind === 'proposal' ? guidance.get(row.selected.proposal.id) : undefined
  const harvestFrom = records?.byCrop.get(row.crop.cropId)?.harvestFrom
  const weatherSource = row.selected.kind === 'proposal' ? row.selected.proposal.signal?.weatherSource : undefined
  return <article className="morning-card">
    <div className="morning-heading">
      <div>
        <p className="ai-proposal-card-meta">{row.crop.cropName}{row.crop.farmName && ` · ${row.crop.farmName}`}</p>
        <h3>{confirmationTitle(row.selected)}</h3>
        <p className="morning-label">{stageLabel[row.selected.stage]}</p>
        {harvestFrom && <RecordGuidance entry={{ harvestFrom }} />}
      </div>
      <div className="morning-reason">
        <p>{row.selected.reason}</p>
        {weatherSource && <WeatherDataSource kind={weatherSource} />}
        {id && <QuestionLink id={id} />}
      </div>
    </div>
    <details className="morning-disclosure">
      <summary>根拠・ほかの確認</summary>
      <ConfirmationDetail item={row.selected} guidance={guidance} />
      <OtherChecks items={row.others} guidance={guidance} />
    </details>
  </article>
}

function FrostDeadline({ rows, guidance }: { rows: CropConfirmation[]; guidance: Guidance }) {
  const { selected } = rows[0]
  if (selected.kind !== 'proposal') return null
  const distinctReasons = new Set(rows.map(row => row.selected.reason))
  return <article className="morning-card morning-deadline">
    <div className="morning-heading">
      <div>
        <h3>{selected.proposal.title}</h3>
        <p>{selected.proposal.layers.conclusion}</p>
        <ul className="morning-targets">
          {rows.map(({ crop }) => <li key={crop.cropId}>
            {crop.cropName}{crop.farmName && ` · ${crop.farmName}`}
          </li>)}
        </ul>
        {rows.map(({ crop, selected }) => {
          const entry = selected.kind === 'proposal' ? guidance.get(selected.proposal.id)?.byCrop.get(crop.cropId) : undefined
          return entry?.harvestFrom && <p key={crop.cropId} className="mt-2 text-sm">
            <strong>{crop.cropName}</strong>
            <RecordGuidance entry={entry} />
          </p>
        })}
      </div>
      <div className="morning-reason">
        {distinctReasons.size === 1 ? <p>{selected.reason}</p> : <ul>
          {rows.map(row => <li key={row.crop.cropId}>{row.crop.farmName ?? row.crop.cropName} · {row.selected.reason}</li>)}
        </ul>}
        <WeatherDataSource kind="forecast" />
      </div>
    </div>
    <details className="morning-disclosure">
      <summary>根拠・ほかの確認</summary>
      {rows.map(row => <div key={row.crop.cropId} className="morning-target-detail">
        <h4 className="font-semibold">{row.crop.cropName}{row.crop.farmName && ` · ${row.crop.farmName}`}</h4>
        <ConfirmationDetail item={row.selected} guidance={guidance} />
        <OtherChecks items={row.others} guidance={guidance} />
      </div>)}
    </details>
  </article>
}

function TaskDeadline({ tasks, guidance }: { tasks: Proposal[]; guidance: Guidance }) {
  const [first] = tasks
  return <article className="morning-card morning-deadline">
    <div className="morning-heading">
      <div>
        <h3>{first.action?.title ?? first.title}</h3>
        <ul className="morning-targets">
          {tasks.map(task => <li key={task.id}>
            <Link href={`/tasks/${task.relatedTaskId}`} className="ai-proposal-card-link">
              {[task.relatedFarmName, task.relatedCropName].filter(Boolean).join(' · ')} →
            </Link>
          </li>)}
        </ul>
      </div>
      <p className="morning-reason">{first.signal?.reason}</p>
    </div>
    <details className="morning-disclosure">
      <summary>タスクの詳細</summary>
      {tasks.map(task => <div key={task.id} className="morning-target-detail">
        <ProposalDetail proposal={task} guidance={guidance} />
      </div>)}
    </details>
  </article>
}

function MilestoneQuestion({ group, guidance }: { group: Proposal[]; guidance: Guidance }) {
  const { milestone, trigger } = group[0]
  if (!milestone || !trigger) return null
  return <li>
    <details id={questionId(trigger)} className="morning-disclosure morning-question">
      <summary>{milestone.question}（{group.length}件）</summary>
      <div className="ai-proposal-card-body">
        <ul className="ai-proposal-card-action-column">
          {group.map(proposal => proposal.relatedCropId && <li key={proposal.id} className="morning-target-detail">
            <p className="font-semibold">{proposal.relatedCropName}{proposal.relatedFarmName && ` · ${proposal.relatedFarmName}`}</p>
            <p className="text-sm">{proposal.signal?.reason}</p>
            <RecordGuidance entry={guidance.get(proposal.id)?.byCrop.get(proposal.relatedCropId)} />
            <MilestoneAskActions
              cropId={proposal.relatedCropId}
              milestoneKey={milestone.key}
              trigger={trigger}
              yesLabel={milestone.yesLabel}
              variant="row"
            />
          </li>)}
        </ul>
        <div className="ai-proposal-evidence">
          <MilestoneEvidence milestone={milestone} standards={[...new Map(group.flatMap(proposal =>
            (guidance.get(proposal.id)?.standards ?? []).map(source => [source.url, source] as const)
          )).values()]} />
          {group[0].signal?.weatherSource && <WeatherDataSource kind={group[0].signal.weatherSource} />}
        </div>
      </div>
    </details>
  </li>
}

export default async function AiProposalPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const data = await loadTodayConfirmations(user.id)
  const cropRows = [...data.deadlineGroups.flat(), ...data.confirmations]
  const guidance = await loadProposalRecordGuidance(user.id, [
    ...cropRows.flatMap(row => [row.selected, ...row.others].flatMap(item => item.kind === 'proposal' ? [item.proposal] : [])),
    ...data.organization, ...data.supplemental,
  ])
  const noConfirmationReasons = Object.keys(missingLabels) as NoConfirmationReason[]

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main">
        <div className="ai-proposal-wrap">
          <header className="ai-proposal-page-header">
            <h1 className="ai-proposal-title">今日の提案</h1>
            <Link href="/records/field" className="btn btn-primary">畑で見たことを記録する</Link>
          </header>

          {data.count === 0 && <p className="morning-empty">今表示する締切・確認事項はありません。</p>}

          {data.deadlineCount > 0 && <section className="ai-proposal-group" aria-labelledby="morning-deadlines">
            <h2 id="morning-deadlines" className="ai-proposal-group-title">締切 <span>{data.deadlineCount}件</span></h2>
            <div className="ai-proposal-list">
              {data.taskGroups.map(tasks => <TaskDeadline key={tasks[0].id} tasks={tasks} guidance={guidance} />)}
              {data.deadlineGroups.map(rows => <FrostDeadline key={rows[0].crop.cropId} rows={rows} guidance={guidance} />)}
            </div>
          </section>}

          {data.confirmations.length > 0 && <section className="ai-proposal-group" aria-labelledby="morning-checks">
            <h2 id="morning-checks" className="ai-proposal-group-title">作付けごとの確認 <span>{data.confirmations.length}件</span></h2>
            <div className="ai-proposal-list">
              {data.confirmations.map(row => <CropCheck key={row.crop.cropId} row={row} guidance={guidance} />)}
            </div>
          </section>}

          {Object.keys(data.noConfirmations).length > 0 && <section className="ai-proposal-group" aria-labelledby="morning-no-checks">
            <h2 id="morning-no-checks" className="ai-proposal-group-title">確認事項がない作付け</h2>
            {noConfirmationReasons.map(reason => {
              const crops = data.noConfirmations[reason]
              return crops?.length ? <details key={reason} className="morning-disclosure">
                <summary>{missingLabels[reason]}（{crops.length}件）</summary>
                <ul className="morning-targets">
                  {crops.map(crop => <li key={crop.cropId}>
                    <Link href={`/crops/${crop.cropId}`} className="ai-proposal-card-link">{crop.cropName}</Link>
                    {crop.farmName && ` · ${crop.farmName}`}
                  </li>)}
                </ul>
              </details> : null
            })}
          </section>}

          {data.organization.length > 0 && <details className="ai-proposal-group morning-disclosure">
            <summary>記録の整理が{data.organization.length}件あります</summary>
            <ul className="ai-proposal-list">
              {data.organization.map(proposal => <li key={proposal.id} className="morning-target-detail">
                <h3 className="font-semibold">{proposal.relatedCropName && `${proposal.relatedCropName} · `}{proposal.title}</h3>
                <ProposalDetail proposal={proposal} guidance={guidance} />
              </li>)}
            </ul>
          </details>}

          {data.supplemental.length > 0 && <section className="ai-proposal-group" aria-labelledby="morning-supplemental">
            <h2 id="morning-supplemental" className="ai-proposal-group-title">昨年の記録・土の診断</h2>
            <ul className="ai-proposal-list">
              {data.supplemental.map(proposal => <li key={proposal.id} className="morning-card">
                <h3 className="font-semibold">{proposal.title}</h3>
                <ProposalDetail proposal={proposal} guidance={guidance} />
              </li>)}
            </ul>
          </section>}

          {(data.milestoneGroups.length > 0 || data.pestGroups.length > 0) && (
            <section className="ai-proposal-group" aria-labelledby="morning-answers">
              <h2 id="morning-answers" className="ai-proposal-group-title">節目・病害虫の回答</h2>
              <ul className="ai-proposal-list">
                {data.milestoneGroups.map(group => <MilestoneQuestion key={group[0].id} group={group} guidance={guidance} />)}
                {data.pestGroups.map(group => <PestQuestion key={group[0].pest.key} id={questionId(pestTrigger(group[0].pest.key))} questions={group} />)}
              </ul>
            </section>
          )}

          <nav className="ai-proposal-footer-nav" aria-label="関連ページ">
            <Link href="/dashboard" className="ai-proposal-back-link">← ダッシュボード</Link>
            <Link href="/insights" className="ai-proposal-back-link">分析・振り返り →</Link>
            <Link href="/gdd" className="ai-proposal-back-link">生育ナビ →</Link>
            <Link href="/calendar" className="ai-proposal-back-link">カレンダー →</Link>
          </nav>
        </div>
      </main>
    </div>
  )
}
