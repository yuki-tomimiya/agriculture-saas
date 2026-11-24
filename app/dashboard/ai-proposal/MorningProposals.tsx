import type { Proposal } from '@/lib/ai-proposal'
import { recordHref, taskHref } from '@/lib/proposals/links'
import Link from 'next/link'
import { CompactWeatherDataSource, JmaDataSource, WeatherDataNotes } from '@/components/WeatherDataSource'
import Sidebar from '@/components/Sidebar'
import ProposalDismissButton from './ProposalDismissButton'
import ProposalSeasonActions from './ProposalSeasonActions'
import MilestoneAskActions from './MilestoneAskActions'
import { isFrostTrigger } from '@/lib/proposals/frost'
import type { ProposalRecordGuidance } from '@/lib/proposals/record-guidance'
import { FertilizerStandards, RecordGuidance } from '@/components/ProposalRecordGuidance'
import PestQuestion, { PestQuestionRow } from './PestQuestion'
import QuestionLink from './QuestionLink'
import type { CropConfirmation, loadTodayConfirmations } from '@/lib/proposals/presentation'
import type { ConfirmationStage, NoConfirmationReason } from '@/lib/proposals/scoring'
import { pestTrigger } from '@/lib/pests/catalog'
import { Fragment, type ReactNode } from 'react'

const stageLabel: Record<ConfirmationStage, string> = {
  deadline: '締切', season: '例年の時期', reached: '目安に到達', window: '見て確かめる時期',
}

const missingLabels: Record<NoConfirmationReason, string> = {
  'record-only': '記録だけの品目',
  'no-planting-date': '植えた日が未入力',
  'planting-later': '植える日がまだ先',
  'no-location': '位置が未登録',
  'no-weather': '必要な天気データがありません',
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

function confirmationTitle(item: Confirmation) {
  return item.kind === 'proposal' ? item.proposal.title : item.question.pest.question
}

function proposalActions(proposal: Proposal): { key: string; node: ReactNode }[] {
  const { action, trigger, relatedCropId, relatedFarmId, relatedTaskId, lines } = proposal
  if (relatedTaskId) {
    return [{ key: `/tasks/${relatedTaskId}`, node: <Link href={`/tasks/${relatedTaskId}`} className="ai-proposal-action ai-proposal-action--primary">タスクを見る</Link> }]
  }
  if (trigger === 'season-finish' && relatedCropId) {
    return [{ key: `finish:${relatedCropId}`, node: <ProposalSeasonActions cropId={relatedCropId} farmId={relatedFarmId} trigger={trigger} /> }]
  }
  const organizationLink = trigger === 'conditions-missing' && relatedCropId
    ? { href: `/crops/${relatedCropId}/edit`, label: '育て方を入れる' }
    : trigger ? organizationLinks[trigger] : undefined
  const items: { key: string; node: ReactNode }[] = []
  const link = (href: string, label: string, primary = false) => items.push({ key: href,
    node: <Link href={href} className={`ai-proposal-action${primary ? ' ai-proposal-action--primary' : ''}`}>{label}</Link> })
  if (organizationLink) link(organizationLink.href, organizationLink.label)
  if (action?.taskType || action?.kind === 'sale' || (relatedCropId && action?.kind === 'work')) link(recordHref(proposal), '記録する', true)
  if (action) link(taskHref(proposal), 'タスクにする')
  if (trigger === 'neglected-crop' && relatedCropId) link(`/crops/${relatedCropId}/edit`, '作付けの状態を変える')
  if (trigger && !isFrostTrigger(trigger)) items.push({
    key: `dismiss:${trigger}:${lines?.map(line => line.cropId).sort().join(',') ?? relatedCropId ?? ''}`,
    node: <ProposalDismissButton trigger={trigger} cropId={relatedCropId} cropIds={lines?.map(line => line.cropId)} />,
  })
  return items
}

function ProposalActions({ proposal }: { proposal: Proposal }) {
  return <div className="ai-proposal-actions">{proposalActions(proposal).map(item => <Fragment key={item.key}>{item.node}</Fragment>)}</div>
}

function ProposalEvidence({ proposal, records, showWeatherCredit }: {
  proposal: Proposal
  records?: ProposalRecordGuidance
  showWeatherCredit: boolean
}) {
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
    {showWeatherCredit && <ProposalWeatherCredit proposals={[proposal]} />}
    <FertilizerStandards standards={records?.standards} />
  </>
}

function ProposalDetail({ proposal, guidance, showWeatherCredit = true, showActions = true }: {
  proposal: Proposal
  guidance: Guidance
  showWeatherCredit?: boolean
  showActions?: boolean
}) {
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
      {showActions && <ProposalActions proposal={proposal} />}
      <div className="ai-proposal-card-links">
        {proposal.relatedCropId && <Link href={`/crops/${proposal.relatedCropId}`} className="ai-proposal-card-link">作付けを見る →</Link>}
        {proposal.relatedCropId && <Link href={`/gdd/${proposal.relatedCropId}`} className="ai-proposal-card-link">生育ナビで見る →</Link>}
        {(proposal.trigger === 'last-year-same-day' || proposal.layers.personal?.includes('昨年同日')) && (
          <Link href="/calendar" className="ai-proposal-card-link">カレンダーで昨年を見る →</Link>
        )}
        {proposal.type === 'weather' && <Link href="/weather" className="ai-proposal-card-link">気象ナビ →</Link>}
      </div>
    </div>
    <div className="ai-proposal-evidence">
      <ProposalEvidence proposal={proposal} records={records} showWeatherCredit={showWeatherCredit} />
    </div>
  </div>
}

function ProposalWeatherCredit({ proposals }: { proposals: Proposal[] }) {
  return <>
    {proposals.some(proposal => proposal.signal?.stationSource) && <JmaDataSource />}
    {proposals.some(proposal => proposal.signal?.weatherSource && !proposal.signal.stationSource) &&
      <CompactWeatherDataSource />}
  </>
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

function ConfirmationDetail({ item, guidance, selected = false }: {
  item: Confirmation
  guidance: Guidance
  selected?: boolean
}) {
  if (item.kind === 'pest') {
    const { pest, timingSource } = item.question
    return <>
      <p>{pest.marker} {pest.appearance && <a className="underline" href={pest.appearance.url}>見た目の資料</a>}</p>
      {timingSource && <a className="underline" href={timingSource}>時期の出典</a>}
      {!selected && <QuestionLink id={questionId(item.trigger)} />}
    </>
  }
  const { proposal } = item
  if (proposal.milestone) {
    const records = guidance.get(proposal.id)
    return <>
      <MilestoneEvidence milestone={proposal.milestone} standards={records?.standards} />
      {!selected && <ProposalWeatherCredit proposals={[proposal]} />}
      <RecordGuidance entry={proposal.relatedCropId ? records?.byCrop.get(proposal.relatedCropId) : undefined} />
      {!selected && <QuestionLink id={questionId(item.trigger)} />}
    </>
  }
  return <ProposalDetail proposal={proposal} guidance={guidance} showWeatherCredit={!selected} showActions={!selected} />
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

function ConfirmationCard({ rows, guidance }: { rows: CropConfirmation[]; guidance: Guidance }) {
  const { selected } = rows[0]
  const deadline = selected.stage === 'deadline'
  const sharedReason = rows.every(row => row.selected.reason === selected.reason)
  const proposals = rows.flatMap(row => row.selected.kind === 'proposal' ? [row.selected.proposal] : [])
  const seenActions = new Set<string>()
  const actions = new Map(rows.map(row => [row.crop.cropId,
    row.selected.kind === 'proposal' && !row.selected.proposal.milestone
      ? proposalActions(row.selected.proposal).filter(item => {
          if (seenActions.has(item.key)) return false
          seenActions.add(item.key)
          return true
        }) : [],
  ]))
  return <article className={deadline ? 'morning-card morning-deadline' : 'morning-card'}>
    <div className="morning-heading">
      <div>
        <h3>{confirmationTitle(selected)}</h3>
        {deadline && selected.kind === 'proposal' && <p>{selected.proposal.layers.conclusion}</p>}
        {!deadline && <p className="morning-label">{stageLabel[selected.stage]}</p>}
        <ul className="morning-targets">
          {rows.map(({ crop, selected: item }) => {
            const proposal = item.kind === 'proposal' ? item.proposal : undefined
            const entry = proposal ? guidance.get(proposal.id)?.byCrop.get(crop.cropId) : undefined
            const milestone = proposal?.milestone
            return <li key={crop.cropId}>
              <p className="font-semibold">{crop.cropName}{crop.farmName && ` · ${crop.farmName}`}</p>
              {entry?.harvestFrom && <RecordGuidance entry={{ harvestFrom: entry.harvestFrom }} />}
              {item.kind === 'pest' && <PestQuestionRow question={item.question} inline />}
              {milestone && <MilestoneAskActions cropId={crop.cropId} milestoneKey={milestone.key}
                trigger={item.trigger} yesLabel={milestone.yesLabel} variant="row" />}
              {!!actions.get(crop.cropId)?.length && <div className="ai-proposal-actions">
                {actions.get(crop.cropId)!.map(action => <Fragment key={action.key}>{action.node}</Fragment>)}
              </div>}
            </li>
          })}
        </ul>
      </div>
      <div className="morning-reason">
        {sharedReason ? <p>{selected.reason}</p> : <ul>
          {rows.map(row => <li key={row.crop.cropId}>{row.crop.cropName}{row.crop.farmName && ` · ${row.crop.farmName}`}：{row.selected.reason}</li>)}
        </ul>}
        <ProposalWeatherCredit proposals={proposals} />
      </div>
    </div>
    <details className="morning-disclosure">
      <summary>根拠・ほかの確認</summary>
      {rows.map(row => <div key={row.crop.cropId} className="morning-target-detail">
        {rows.length > 1 && <h4 className="font-semibold">{row.crop.cropName}{row.crop.farmName && ` · ${row.crop.farmName}`}</h4>}
        <ConfirmationDetail item={row.selected} guidance={guidance} selected />
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
          <ProposalWeatherCredit proposals={group} />
        </div>
      </div>
    </details>
  </li>
}

type EmptyState = { farms: { id: string }[]; hasGrowingCrops: boolean }

export function EmptyMorning({ state, undated = [] }: { state?: EmptyState; undated?: { cropId: string }[] }) {
  if (state?.farms.length !== 0 && undated.length > 0) {
    return <div className="morning-empty space-y-3">
      <p>植えた日を入れると、ここに毎朝の確認が出ます</p>
      {undated.length === 1 && <Link href={`/crops/${undated[0].cropId}/edit`}
        className="ai-proposal-action ai-proposal-action--primary min-h-11 max-w-full whitespace-normal">
        植えた日を入れる
      </Link>}
    </div>
  }
  if (!state || (state.farms.length > 0 && state.hasGrowingCrops)) {
    return <p className="morning-empty">今表示する締切・確認事項はありません。</p>
  }
  if (state.farms.length === 0) {
    return <div className="morning-empty space-y-3">
      <p>農場を登録すると、この土地の霜と気温が見られます</p>
      <Link href="/farms/new" className="ai-proposal-action ai-proposal-action--primary min-h-11 max-w-full whitespace-normal">
        農場を登録する
      </Link>
    </div>
  }
  const farm = state.farms.length === 1 ? state.farms[0] : null
  return <div className="morning-empty space-y-3">
    <p>育てているものを登録すると、ここに毎朝の確認が出ます</p>
    <Link href={farm ? `/crops/new?farmId=${encodeURIComponent(farm.id)}` : '/crops/new'}
      className="ai-proposal-action ai-proposal-action--primary min-h-11 max-w-full whitespace-normal">
      育てているものを登録する
    </Link>
    <p>霜・地域区分・土は、農場の詳細で見られます</p>
    <Link href={farm ? `/farms/${encodeURIComponent(farm.id)}` : '/farms'}
      className="ai-proposal-action min-h-11 max-w-full whitespace-normal">
      {farm ? '農場の詳細を見る' : '農場一覧を見る'}
    </Link>
  </div>
}

export default function MorningProposals({ data, guidance, emptyState }: {
  data: Awaited<ReturnType<typeof loadTodayConfirmations>>
  guidance: Guidance
  emptyState?: EmptyState
}) {
  const weatherSources = new Set(guidanceProposals(data).map(proposal =>
    proposal.signal?.stationSource ? undefined : proposal.signal?.weatherSource))
  const noConfirmationReasons = Object.keys(missingLabels) as NoConfirmationReason[]
  const undated = data.noConfirmations['no-planting-date'] ?? []

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main">
        <div className="ai-proposal-wrap">
          <header className="ai-proposal-page-header">
            <h1 className="ai-proposal-title">今日の提案</h1>
            <Link href="/records/field" className="btn btn-primary">畑で見たことを記録する</Link>
          </header>

          {data.count === 0 && <EmptyMorning state={emptyState} undated={undated} />}

          {data.deadlineCount > 0 && <section className="ai-proposal-group" aria-labelledby="morning-deadlines">
            <h2 id="morning-deadlines" className="ai-proposal-group-title">締切 <span>{data.deadlineCount}件</span></h2>
            <div className="ai-proposal-list">
              {data.taskGroups.map(tasks => <TaskDeadline key={tasks[0].id} tasks={tasks} guidance={guidance} />)}
              {data.deadlineGroups.map(rows => <ConfirmationCard key={rows[0].crop.cropId} rows={rows} guidance={guidance} />)}
            </div>
          </section>}

          {data.confirmationGroups.length > 0 && <section className="ai-proposal-group" aria-labelledby="morning-checks">
            <h2 id="morning-checks" className="ai-proposal-group-title">作付けごとの確認 <span>{data.confirmationGroups.length}件</span></h2>
            <div className="ai-proposal-list">
              {data.confirmationGroups.map(rows => <ConfirmationCard key={rows[0].crop.cropId} rows={rows} guidance={guidance} />)}
            </div>
          </section>}

          {Object.keys(data.noConfirmations).length > 0 && <section className="ai-proposal-group" aria-labelledby="morning-no-checks">
            <h2 id="morning-no-checks" className="ai-proposal-group-title">確認事項がない作付け</h2>
            {noConfirmationReasons.map(reason => {
              const crops = data.noConfirmations[reason]
              return crops?.length ? <details key={reason} className="morning-disclosure"
                open={data.count === 0 && emptyState?.farms.length !== 0 && reason === 'no-planting-date' && crops.length > 1}>
                <summary>{missingLabels[reason]}（{crops.length}件）</summary>
                <ul className="morning-targets">
                  {crops.map(crop => <li key={crop.cropId}>
                    <Link href={`/crops/${crop.cropId}${reason === 'no-planting-date' ? '/edit' : ''}`}
                      className="ai-proposal-card-link">{crop.cropName}</Link>
                    {crop.farmName && ` · ${crop.farmName}`}
                    {reason === 'planting-later' && crop.plantingDate && ` · ${crop.plantingDate}から`}
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

          {(data.remainingMilestoneGroups.length > 0 || data.remainingPestGroups.length > 0) && (
            <section className="ai-proposal-group" aria-labelledby="morning-answers">
              <h2 id="morning-answers" className="ai-proposal-group-title">節目・病害虫の回答</h2>
              <ul className="ai-proposal-list">
                {data.remainingMilestoneGroups.map(group => <MilestoneQuestion key={group[0].id} group={group} guidance={guidance} />)}
                {data.remainingPestGroups.map(group => <PestQuestion key={group[0].pest.key} id={questionId(pestTrigger(group[0].pest.key))} questions={group} />)}
              </ul>
            </section>
          )}

          <WeatherDataNotes archive={weatherSources.has('archive') || weatherSources.has('mixed')}
            forecast={weatherSources.has('forecast') || weatherSources.has('mixed')} />

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

export function guidanceProposals(data: Awaited<ReturnType<typeof loadTodayConfirmations>>): Proposal[] {
  const rows = [...data.deadlineGroups.flat(), ...data.confirmationGroups.flat()]
  return [
    ...rows.flatMap(row => [row.selected, ...row.others].flatMap(item =>
      item.kind === 'proposal' ? [item.proposal] : [])),
    ...data.organization, ...data.supplemental,
  ]
}
