import { getTodayProposals, type Proposal } from '@/lib/ai-proposal'
import { loadPestQuestions } from '@/lib/pests/service'
import { groupPestQuestions } from '@/lib/pests/presentation'
import { isMilestoneTrigger } from '@/lib/proposals/milestones'

function isConfirm(trigger?: string): boolean {
  return trigger === 'season-finish' ||
    trigger === 'conditions-missing' ||
    trigger === 'result-missing' ||
    trigger === 'place-missing' ||
    isMilestoneTrigger(trigger)
}

export function groupTodayProposals<
  P extends Pick<Proposal, 'urgency' | 'trigger'>,
  Q extends { pest: { key: string } },
>(proposals: P[], pestQuestions: Q[]) {
  return {
    todayItems: proposals.filter(item => item.urgency === 'today' && !isConfirm(item.trigger)),
    weekItems: proposals.filter(item => item.urgency === 'thisWeek' && !isConfirm(item.trigger)),
    confirmItems: proposals.filter(item => isConfirm(item.trigger)),
    pestGroups: groupPestQuestions(pestQuestions),
    watchCount: proposals.filter(item => item.urgency === 'watch').length,
  }
}

export async function loadTodayProposalGroups(userId: string) {
  // どちらも「今はしない」などで閉じたカードを除いて返す。
  const [proposals, pestQuestions] = await Promise.all([
    getTodayProposals(userId),
    loadPestQuestions(userId),
  ])
  return groupTodayProposals(proposals, pestQuestions)
}
