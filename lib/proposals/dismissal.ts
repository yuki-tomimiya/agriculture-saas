import { prisma } from '@/lib/prisma'
import { PROPOSAL_DISMISS_DAYS, SEASON_FINISH_TRIGGER } from '@/lib/proposals/constants'
import { isMilestoneTrigger } from '@/lib/proposals/milestones'

export { PROPOSAL_DISMISS_DAYS, SEASON_FINISH_DISMISS_DAYS, SEASON_FINISH_TRIGGER } from '@/lib/proposals/constants'

export function proposalRemindAfter(from = new Date(), days = PROPOSAL_DISMISS_DAYS): Date {
  const remind = new Date(from)
  remind.setHours(0, 0, 0, 0)
  remind.setDate(remind.getDate() + days)
  return remind
}

export async function listActiveDismissals(userId: string, now = new Date()) {
  return prisma.proposalDismissal.findMany({
    where: { userId, remindAfter: { gt: now } },
    select: { trigger: true, cropId: true },
  })
}

/** 終了確認と節目の［まだ］は、そのカードだけを隠す。それ以外の1件は作付け全体を隠す */
function hidesWholeCrop(trigger: string): boolean {
  return trigger !== SEASON_FINISH_TRIGGER && !isMilestoneTrigger(trigger)
}

export function isProposalDismissed(
  rows: { trigger: string; cropId: string | null }[],
  trigger: string | undefined,
  cropId?: string
): boolean {
  if (cropId) {
    const cropRows = rows.filter((row) => row.cropId === cropId)
    if (cropRows.some((row) => hidesWholeCrop(row.trigger))) return true
    if (!trigger) return false
    return cropRows.some((row) => row.trigger === trigger)
  }
  if (!trigger) return false
  return rows.some((row) => row.trigger === trigger && (row.cropId ?? null) === null)
}
