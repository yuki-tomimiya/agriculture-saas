import { prisma } from '@/lib/prisma'
import { PROPOSAL_DISMISS_DAYS, SEASON_FINISH_TRIGGER } from '@/lib/proposals/constants'

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

export function isProposalDismissed(
  rows: { trigger: string; cropId: string | null }[],
  trigger: string | undefined,
  cropId?: string
): boolean {
  if (cropId) {
    const cropRows = rows.filter((row) => row.cropId === cropId)
    if (cropRows.some((row) => row.trigger !== SEASON_FINISH_TRIGGER)) return true
    return trigger === SEASON_FINISH_TRIGGER && cropRows.some((row) => row.trigger === SEASON_FINISH_TRIGGER)
  }
  if (!trigger) return false
  return rows.some((row) => row.trigger === trigger && (row.cropId ?? null) === null)
}
