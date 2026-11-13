import { loadProposalCandidates, type Proposal, type ProposalOptions } from '@/lib/ai-proposal'
import { loadPestQuestions } from '@/lib/pests/service'
import { groupPestQuestions } from '@/lib/pests/presentation'
import type { ConfirmationCrop, ConfirmationStage, NoConfirmationReason } from '@/lib/proposals/scoring'
import { pestTrigger } from '@/lib/pests/catalog'

export type PestQuestion = Awaited<ReturnType<typeof loadPestQuestions>>[number]

type Confirmation = { stage: ConfirmationStage; reason: string; trigger: string } & (
  { kind: 'proposal'; proposal: Proposal } | { kind: 'pest'; question: PestQuestion }
)

const stageOrder: Record<ConfirmationStage, number> = { deadline: 0, season: 1, reached: 2, window: 3 }

function compareConfirmations(a: Confirmation, b: Confirmation) {
  return stageOrder[a.stage] - stageOrder[b.stage] ||
    (a.kind === 'proposal' ? a.proposal.signal?.deadline ?? '' : '').localeCompare(
      b.kind === 'proposal' ? b.proposal.signal?.deadline ?? '' : '',
    ) ||
    Number(a.kind === 'pest') - Number(b.kind === 'pest') ||
    a.trigger.localeCompare(b.trigger)
}

export type CropConfirmation = {
  crop: ConfirmationCrop
  selected: Confirmation
  others: Confirmation[]
}

export function organizeConfirmations(proposals: Proposal[], crops: ConfirmationCrop[], pestQuestions: PestQuestion[]) {
  const byCrop = new Map<string, Confirmation[]>()
  function add(cropId: string, item: Confirmation) {
    const list = byCrop.get(cropId) ?? []
    list.push(item)
    byCrop.set(cropId, list)
  }
  const tasks = new Map<string, Proposal[]>()
  const organization: Proposal[] = []
  const supplemental: Proposal[] = []
  const milestones = new Map<string, Proposal[]>()

  for (const proposal of proposals) {
    const { relatedCropId, signal, trigger } = proposal
    if (trigger === 'task-due') {
      const key = JSON.stringify([signal?.deadline, proposal.action?.title])
      const group = tasks.get(key) ?? []
      group.push(proposal)
      tasks.set(key, group)
    } else if (signal?.stage === 'organize') {
      organization.push(proposal)
    } else if (relatedCropId && trigger && signal?.reason) {
      add(relatedCropId, { kind: 'proposal', stage: signal.stage, reason: signal.reason, trigger, proposal })
      if (proposal.milestone) {
        const list = milestones.get(trigger) ?? []
        list.push(proposal)
        milestones.set(trigger, list)
      }
    } else {
      supplemental.push(proposal)
    }
  }

  for (const question of pestQuestions) {
    add(question.cropId, {
      kind: 'pest', stage: 'window', trigger: pestTrigger(question.pest.key), question,
      reason: question.timing ?? 'この品目の見回りの時期です。',
    })
  }

  const deadlines = new Map<string, CropConfirmation[]>()
  const confirmations: CropConfirmation[] = []
  const noConfirmations: Partial<Record<NoConfirmationReason, ConfirmationCrop[]>> = {}
  for (const crop of crops) {
    const [selected, ...others] = (byCrop.get(crop.cropId) ?? []).sort(compareConfirmations)
    if (!selected) {
      (noConfirmations[crop.reason] ??= []).push(crop)
      continue
    }
    const row = { crop, selected, others }
    if (selected.stage === 'deadline' && selected.kind === 'proposal') {
      const { proposal } = selected
      const key = JSON.stringify([proposal.signal?.deadline, proposal.layers.conclusion])
      const group = deadlines.get(key) ?? []
      group.push(row)
      deadlines.set(key, group)
    } else {
      confirmations.push(row)
    }
  }

  const deadlineGroups = [...deadlines.values()].sort((a, b) => compareConfirmations(a[0].selected, b[0].selected))
  confirmations.sort((a, b) => compareConfirmations(a.selected, b.selected))
  const taskGroups = [...tasks.values()]
  const deadlineCount = taskGroups.reduce((count, group) => count + group.length, 0) +
    deadlineGroups.reduce((count, group) => count + group.length, 0)

  return {
    taskGroups, deadlineGroups, deadlineCount, confirmations, noConfirmations, organization, supplemental,
    milestoneGroups: [...milestones.values()], pestGroups: groupPestQuestions(pestQuestions),
    count: deadlineCount + confirmations.length,
  }
}

export async function loadTodayConfirmations(userId: string, { now = new Date(), weather }: ProposalOptions = {}) {
  const [{ proposals, crops }, pestQuestions] = await Promise.all([
    loadProposalCandidates(userId, { now, weather }, true),
    loadPestQuestions(userId, now),
  ])
  return organizeConfirmations(proposals, crops, pestQuestions)
}
